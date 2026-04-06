import { eq, and } from "drizzle-orm"
import type { AppDatabase } from "../db/connection"
import type { CollectionDef, HookContext } from "../types"
import { runHook } from "./hooks"
import { extractTextFromPortableText } from "./search"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any

type FindManyOpts = {
  limit?: number
  offset?: number
  where?: Record<string, unknown>
}

export function createContentService(
  db: AppDatabase,
  collection: CollectionDef,
  table: AnyTable,
  versioning?: { createVersion: (collection: string, docId: string, data: Record<string, unknown>, action: "save" | "publish") => unknown },
  search?: { index: (collection: string, docId: string, title: string, bodyText: string) => void; remove: (collection: string, docId: string) => void },
) {
  const ctx: HookContext = { collection: collection.name, db }

  async function create(data: Record<string, unknown>) {
    let doc: Record<string, unknown> = await runHook("beforeSave", collection.hooks, data, ctx)

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const row = { ...doc, id, created_at: now, updated_at: now }

    db.insert(table).values(row).run()

    const rows = db.select().from(table).where(eq(table.id, id)).all()
    let saved = rows[0] as Record<string, unknown>
    saved = await runHook("afterSave", collection.hooks, saved, ctx)

    if (versioning) {
      versioning.createVersion(collection.name, id, saved, "save")
    }

    if (search) {
      search.index(collection.name, id, String(saved.title ?? ""), extractTextFromPortableText(saved.body))
    }

    return saved
  }

  async function findById(id: string): Promise<Record<string, unknown> | null> {
    const rows = db.select().from(table).where(eq(table.id, id)).all()
    return (rows[0] as Record<string, unknown>) ?? null
  }

  async function findMany(opts?: FindManyOpts): Promise<Record<string, unknown>[]> {
    let query = db.select().from(table)

    if (opts?.where) {
      const conditions = Object.entries(opts.where)
        .map(([key, value]) => {
          const col = table[key]
          if (col === undefined) return undefined
          return eq(col, value)
        })
        .filter(Boolean)

      if (conditions.length === 1) {
        query = query.where(conditions[0]) as typeof query
      } else if (conditions.length > 1) {
        query = query.where(and(...conditions)) as typeof query
      }
    }

    if (opts?.limit !== undefined) {
      query = query.limit(opts.limit) as typeof query
    }

    if (opts?.offset !== undefined) {
      query = query.offset(opts.offset) as typeof query
    }

    return query.all() as Record<string, unknown>[]
  }

  async function update(id: string, data: Record<string, unknown>) {
    const existing = await findById(id)
    if (!existing) {
      throw new Error(`Document with id "${id}" not found in collection "${collection.name}"`)
    }

    let doc: Record<string, unknown> = await runHook(
      "beforeSave",
      collection.hooks,
      { ...existing, ...data },
      ctx,
    )

    const updatedAt = new Date().toISOString()
    db.update(table).set({ ...doc, updated_at: updatedAt }).where(eq(table.id, id)).run()

    const rows = db.select().from(table).where(eq(table.id, id)).all()
    let updated = rows[0] as Record<string, unknown>
    updated = await runHook("afterSave", collection.hooks, updated, ctx)

    const action = updated.status === "published" ? "publish" : "save"
    if (versioning) {
      versioning.createVersion(collection.name, id, updated, action as "save" | "publish")
    }

    if (search) {
      search.index(collection.name, id, String(updated.title ?? ""), extractTextFromPortableText(updated.body))
    }

    return updated
  }

  async function remove(id: string): Promise<boolean> {
    const existing = await findById(id)
    if (!existing) return false

    await runHook("beforeDelete", collection.hooks, existing, ctx)
    if (search) {
      search.remove(collection.name, id)
    }
    db.delete(table).where(eq(table.id, id)).run()
    await runHook("afterDelete", collection.hooks, existing, ctx)

    return true
  }

  return { create, findById, findMany, update, remove }
}
