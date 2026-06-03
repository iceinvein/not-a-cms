import { and, asc, count as countRows, desc, eq, gt, inArray, like, lt, ne } from "drizzle-orm"
import type { AppDatabase } from "../db/connection"
import type { CollectionDef, ContentStatus, HookContext } from "../types"
import { runHook } from "./hooks"
import { extractMediaReferences } from "./media-references"
import { extractTextFromPortableText } from "./search"
import {
  deserializeDocumentFromStorage,
  serializeDocumentForStorage,
  serializeFieldValue,
  storageKeyForField,
} from "./serialization"
import { applyDefaultsAndValidate } from "./validation"
import { WorkflowError, type WorkflowAction, resolveWorkflowTransition } from "./workflow"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any

type FindManyOpts = {
  limit?: number
  offset?: number
  where?: Record<string, unknown>
  sort?: string
  order?: "asc" | "desc"
}

type CountOpts = {
  where?: Record<string, unknown>
}

type UpdateOpts = {
  allowStatusChange?: boolean
  suppressAutomations?: boolean
  versionAction?: "save" | "publish"
}

type WriteOpts = {
  suppressAutomations?: boolean
}

type ContentEmbeddingHooks = {
  index: (collection: string, docId: string, title: string, bodyText: string) => void | Promise<void>
  remove: (collection: string, docId: string) => void | Promise<void>
}

type MediaReferenceHooks = {
  replaceForDocument: (collection: string, docId: string, refs: { assetId: string; field: string; label: string }[]) => void
  removeDocument: (collection: string, docId: string) => void
}

export class QueryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "QueryError"
  }
}

export function createContentService(
  db: AppDatabase,
  collection: CollectionDef,
  table: AnyTable,
  versioning?: { createVersion: (collection: string, docId: string, data: Record<string, unknown>, action: "save" | "publish") => unknown },
  search?: { index: (collection: string, docId: string, title: string, bodyText: string) => void; remove: (collection: string, docId: string) => void },
  automations?: { dispatch: (event: string, collection: string, doc: Record<string, unknown>) => void },
  embeddings?: ContentEmbeddingHooks,
  mediaReferences?: MediaReferenceHooks,
) {
  const ctx: HookContext = { collection: collection.name, db }

  async function create(data: Record<string, unknown>, opts: WriteOpts = {}) {
    let doc = applyDefaultsAndValidate(collection, data)
    doc = await runHook("beforeSave", collection.hooks, doc, ctx)
    doc = applyDefaultsAndValidate(collection, doc)

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const row = serializeDocumentForStorage(collection, { ...doc, id, created_at: now, updated_at: now })

    db.insert(table).values(row).run()

    const rows = db.select().from(table).where(eq(table.id, id)).all()
    let saved = normalizeDocument(rows[0] as Record<string, unknown>)
    saved = await runHook("afterSave", collection.hooks, saved, ctx)

    if (versioning) {
      versioning.createVersion(collection.name, id, saved, "save")
    }

    indexDocument(id, saved)

    if (!opts.suppressAutomations) {
      automations?.dispatch("content.created", collection.name, saved)
    }

    return saved
  }

  async function findById(id: string): Promise<Record<string, unknown> | null> {
    const rows = db.select().from(table).where(eq(table.id, id)).all()
    const row = rows[0] as Record<string, unknown> | undefined
    return row ? normalizeDocument(row) : null
  }

  async function findMany(opts?: FindManyOpts): Promise<Record<string, unknown>[]> {
    let query = db.select().from(table)

    const conditions = buildWhere(opts?.where)
    if (conditions.length === 1) {
      query = query.where(conditions[0]) as typeof query
    } else if (conditions.length > 1) {
      query = query.where(and(...conditions)) as typeof query
    }

    if (opts?.sort) {
      const col = columnForField(opts.sort)
      query = query.orderBy((opts.order ?? "asc") === "desc" ? desc(col) : asc(col)) as typeof query
    }

    if (opts?.limit !== undefined) {
      query = query.limit(opts.limit) as typeof query
    }

    if (opts?.offset !== undefined) {
      query = query.offset(opts.offset) as typeof query
    }

    return (query.all() as Record<string, unknown>[]).map(normalizeDocument)
  }

  async function count(opts?: CountOpts): Promise<number> {
    let query = db.select({ total: countRows() }).from(table)
    const conditions = buildWhere(opts?.where)
    if (conditions.length === 1) {
      query = query.where(conditions[0]) as typeof query
    } else if (conditions.length > 1) {
      query = query.where(and(...conditions)) as typeof query
    }
    const rows = query.all() as Array<{ total: number }>
    return Number(rows[0]?.total ?? 0)
  }

  async function update(id: string, data: Record<string, unknown>, opts: UpdateOpts = {}) {
    const existing = await findById(id)
    if (!existing) {
      throw new Error(`Document with id "${id}" not found in collection "${collection.name}"`)
    }

    if (!opts.allowStatusChange && "status" in data && data.status !== existing.status) {
      throw new WorkflowError("Use a workflow action to change content status")
    }

    const wasPublished = existing.status === "published"

    let doc = applyDefaultsAndValidate(collection, { ...existing, ...data })
    doc = await runHook(
      "beforeSave",
      collection.hooks,
      doc,
      ctx,
    )
    doc = applyDefaultsAndValidate(collection, doc)

    const updatedAt = new Date().toISOString()
    db.update(table).set(serializeDocumentForStorage(collection, { ...doc, updated_at: updatedAt })).where(eq(table.id, id)).run()

    const rows = db.select().from(table).where(eq(table.id, id)).all()
    let updated = normalizeDocument(rows[0] as Record<string, unknown>)
    updated = await runHook("afterSave", collection.hooks, updated, ctx)

    const action = opts.versionAction ?? (updated.status === "published" ? "publish" : "save")
    if (versioning) {
      versioning.createVersion(collection.name, id, updated, action as "save" | "publish")
    }

    indexDocument(id, updated)

    const isNowPublished = updated.status === "published"
    if (opts.suppressAutomations) {
      return updated
    }

    if (!wasPublished && isNowPublished) {
      automations?.dispatch("content.published", collection.name, updated)
    } else {
      automations?.dispatch("content.updated", collection.name, updated)
    }

    return updated
  }

  async function transitionStatus(id: string, action: WorkflowAction, role: string) {
    if (!collection.fields.status) {
      throw new WorkflowError(`Collection "${collection.name}" does not define a status field`)
    }

    const existing = await findById(id)
    if (!existing) {
      throw new Error(`Document with id "${id}" not found in collection "${collection.name}"`)
    }

    const from = normalizeStatus(existing.status)
    const transition = resolveWorkflowTransition(from, action, role)

    if (transition.to === from) {
      return existing
    }

    let nextDoc: Record<string, unknown> = { ...existing, status: transition.to }
    if (action === "publish") {
      nextDoc = await runHook("beforePublish", collection.hooks, nextDoc, ctx)
    }

    let updated = await update(id, nextDoc, {
      allowStatusChange: true,
      versionAction: action === "publish" ? "publish" : "save",
    })

    if (action === "publish") {
      updated = await runHook("afterPublish", collection.hooks, updated, ctx)
    }

    return updated
  }

  async function bulkUpdate(ids: string[], data: Record<string, unknown>, opts: UpdateOpts = {}) {
    const updated: Record<string, unknown>[] = []
    const notFound: string[] = []
    for (const id of uniqueIds(ids)) {
      if (!await findById(id)) {
        notFound.push(id)
        continue
      }
      updated.push(await update(id, data, opts))
    }
    return { updated, notFound }
  }

  async function bulkTransitionStatus(ids: string[], action: WorkflowAction, role: string) {
    const updated: Record<string, unknown>[] = []
    const notFound: string[] = []
    for (const id of uniqueIds(ids)) {
      if (!await findById(id)) {
        notFound.push(id)
        continue
      }
      updated.push(await transitionStatus(id, action, role))
    }
    return { updated, notFound }
  }

  async function remove(id: string, opts: WriteOpts = {}): Promise<boolean> {
    const existing = await findById(id)
    if (!existing) return false

    await runHook("beforeDelete", collection.hooks, existing, ctx)
    if (search) {
      search.remove(collection.name, id)
    }
    removeEmbedding(id)
    if (mediaReferences) {
      try { mediaReferences.removeDocument(collection.name, id) } catch {}
    }
    db.delete(table).where(eq(table.id, id)).run()
    await runHook("afterDelete", collection.hooks, existing, ctx)

    if (!opts.suppressAutomations) {
      automations?.dispatch("content.deleted", collection.name, existing)
    }

    return true
  }

  async function bulkDelete(ids: string[]) {
    const deleted: string[] = []
    const notFound: string[] = []
    for (const id of uniqueIds(ids)) {
      const didDelete = await remove(id)
      if (didDelete) deleted.push(id)
      else notFound.push(id)
    }
    return { deleted, notFound }
  }

  function extractIndexableText(doc: Record<string, unknown>): { title: string; bodyText: string } {
    const textParts: string[] = []
    const richParts: string[] = []
    for (const [name, fieldDef] of Object.entries(collection.fields)) {
      if (fieldDef.type === "text" && doc[name]) textParts.push(String(doc[name]))
      if (fieldDef.type === "richText" && doc[name]) richParts.push(extractTextFromPortableText(doc[name]))
    }
    return { title: textParts.join(" "), bodyText: richParts.join(" ") }
  }

  function indexDocument(docId: string, doc: Record<string, unknown>) {
    const { title, bodyText } = extractIndexableText(doc)
    search?.index(collection.name, docId, title, bodyText)
    indexEmbedding(docId, title, bodyText)
    indexMediaReferences(docId, doc)
  }

  function indexMediaReferences(docId: string, doc: Record<string, unknown>) {
    if (!mediaReferences) return
    try {
      mediaReferences.replaceForDocument(collection.name, docId, extractMediaReferences(collection, doc))
    } catch {
      // The reference index is derived state; never fail a content write on it.
    }
  }

  function indexEmbedding(docId: string, title: string, bodyText: string) {
    if (!embeddings) return
    try {
      Promise.resolve(embeddings.index(collection.name, docId, title, bodyText)).catch(() => {})
    } catch {
      // Embedding providers are optional integrations and must not fail content writes.
    }
  }

  function removeEmbedding(docId: string) {
    if (!embeddings) return
    try {
      Promise.resolve(embeddings.remove(collection.name, docId)).catch(() => {})
    } catch {
      // Embedding providers are optional integrations and must not fail content writes.
    }
  }

  function normalizeDocument(doc: Record<string, unknown>): Record<string, unknown> {
    return deserializeDocumentFromStorage(collection, doc)
  }

  function buildWhere(where?: Record<string, unknown>) {
    if (!where) return []

    return Object.entries(where).flatMap(([fieldName, value]) => {
      const { col, fieldDef } = columnAndField(fieldName)
      if (isOperatorObject(value)) {
        return Object.entries(value).map(([operator, operand]) => {
          const serialized = fieldDef ? serializeFieldValue(operand, fieldDef) : operand
          switch (operator) {
            case "eq":
              return eq(col, serialized)
            case "neq":
              return ne(col, serialized)
            case "contains":
              return like(col, `%${String(operand)}%`)
            case "in":
              if (!Array.isArray(operand)) throw new QueryError(`Operator "in" for field "${fieldName}" expects an array`)
              return inArray(col, fieldDef ? operand.map((item) => serializeFieldValue(item, fieldDef)) : operand)
            case "gt":
              return gt(col, serialized)
            case "lt":
              return lt(col, serialized)
            default:
              throw new QueryError(`Unsupported operator "${operator}" for field "${fieldName}"`)
          }
        })
      }
      return [eq(col, fieldDef ? serializeFieldValue(value, fieldDef) : value)]
    })
  }

  function columnForField(fieldName: string) {
    return columnAndField(fieldName).col
  }

  function columnAndField(fieldName: string) {
    if (fieldName === "id" || fieldName === "created_at" || fieldName === "updated_at") {
      return { col: table[fieldName], fieldDef: undefined }
    }
    const fieldDef = collection.fields[fieldName]
    if (!fieldDef) throw new QueryError(`Unknown field "${fieldName}" in collection "${collection.name}"`)
    const storageKey = storageKeyForField(fieldName, fieldDef)
    const col = table[storageKey]
    if (col === undefined) throw new QueryError(`Unknown field "${fieldName}" in collection "${collection.name}"`)
    return { col, fieldDef }
  }

  function isOperatorObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
  }

  function normalizeStatus(value: unknown): ContentStatus {
    if (value === "draft" || value === "in_review" || value === "published" || value === "archived" || value === "scheduled") return value
    return "draft"
  }

  function uniqueIds(ids: string[]): string[] {
    return Array.from(new Set(ids.filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim())))
  }

  return { create, findById, findMany, count, update, bulkUpdate, transitionStatus, bulkTransitionStatus, remove, bulkDelete }
}
