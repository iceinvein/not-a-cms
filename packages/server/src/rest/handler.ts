import type {
  AskProvider,
  AuditEventInput,
  CollectionDef,
  createContentService,
  EmbeddingStore,
  SettingsService,
  VersioningService,
  WebhookService,
  WebhookStore,
} from "@not-a-cms/core"
import {
  canAccessCollection,
  compareVersionData,
  extractTextFromPortableText,
  filterWritableFields,
  isWorkflowAction,
  populateDocuments,
  projectDocumentFields,
  QueryError,
  ValidationError,
  WorkflowError,
} from "@not-a-cms/core"
import { type EmailOptions, portableTextToEmail } from "@not-a-cms/renderer"
import { runAsk } from "../ask/handler"

export type CollectionEntry = {
  def: CollectionDef
  table: any
  service: ReturnType<typeof createContentService>
}

type AuthorizeRequest = (req: Request) => boolean | Promise<boolean>
type GetRole = (req: Request) => string | null | Promise<string | null>
type RequestActor = { userId: string; role: string }
type GetActor = (req: Request) => RequestActor | null | Promise<RequestActor | null>

type RestHandlerOptions = {
  authorize?: AuthorizeRequest
  getRole?: GetRole
  getActor?: GetActor
  auditLog?: {
    record: (event: AuditEventInput) => unknown
  }
  media?: {
    get: (id: string) => Record<string, unknown> | null | Promise<Record<string, unknown> | null>
  }
  webhookService?: WebhookService
  ask?: {
    provider?: AskProvider
    embeddings?: EmbeddingStore
    topK?: number
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export function createRestHandler(
  collections: Map<string, CollectionEntry>,
  versioning?: VersioningService,
  search?: {
    query: (term: string, collection?: string) => Array<{ collection: string; document_id: string }>
  },
  webhookStore?: WebhookStore,
  settingsService?: SettingsService,
  options: RestHandlerOptions = {},
) {
  async function requireAuthorized(req: Request): Promise<Response | null> {
    const authorized = options.authorize ? await options.authorize(req) : false
    return authorized ? null : json({ error: "Unauthorized" }, 401)
  }

  async function isAuthed(req: Request): Promise<boolean> {
    return options.authorize ? await options.authorize(req) : false
  }

  // Unauthenticated callers may only read published content. The public site
  // requests status=published explicitly; drafts/scheduled/archived must require auth.
  function publishedOnlyFor(authed: boolean, entry: CollectionEntry): boolean {
    return !authed && Boolean(entry.def.fields.status)
  }

  async function requireAdmin(req: Request): Promise<Response | null> {
    const role = await getRole(req)
    return role === "admin" ? null : json({ error: "Forbidden" }, 403)
  }

  async function getRole(req: Request): Promise<string> {
    return (await options.getActor?.(req))?.role ?? (await options.getRole?.(req)) ?? "viewer"
  }

  async function getActor(req: Request): Promise<RequestActor | null> {
    const actor = await options.getActor?.(req)
    if (actor) return actor
    const role = await options.getRole?.(req)
    return role ? { userId: "unknown", role } : null
  }

  async function requireCollectionAccess(
    req: Request,
    entry: CollectionEntry,
    action: "read" | "create" | "update" | "delete",
  ): Promise<Response | null> {
    const role = await getRole(req)
    return canAccessCollection(entry.def, role, action) ? null : json({ error: "Forbidden" }, 403)
  }

  async function recordAudit(req: Request, event: Omit<AuditEventInput, "actorId" | "actorRole">) {
    if (!options.auditLog) return
    const actor = await getActor(req)
    options.auditLog.record({
      ...event,
      actorId: actor?.userId ?? null,
      actorRole: actor?.role ?? null,
    })
  }

  return async function handler(req: Request): Promise<Response | null> {
    const url = new URL(req.url)
    const pathname = url.pathname

    // Only handle /api/ routes
    if (!pathname.startsWith("/api/")) {
      return null
    }

    // Parse /api/:collection and /api/:collection/:id
    const segments = pathname.slice("/api/".length).split("/").filter(Boolean)
    if (segments.length === 0) {
      return null
    }

    const collectionName = segments[0]
    const id = segments[1] ?? null
    const method = req.method.toUpperCase()

    // Webhook management: /api/_webhooks
    if (collectionName === "_webhooks" && webhookStore) {
      const unauthorized = await requireAuthorized(req)
      if (unauthorized) return unauthorized
      const forbidden = await requireAdmin(req)
      if (forbidden) return forbidden

      if (id === null) {
        if (method === "GET") return json({ data: webhookStore.list() })
        if (method === "POST") {
          const body = await req.json()
          const validationError = validateWebhookInput(body)
          if (validationError) return json({ error: validationError }, 400)
          const hook = webhookStore.create({
            url: body.url,
            events: body.events,
            collection: body.collection,
            secret: body.secret,
            active: body.active ?? true,
          })
          return json(hook, 201)
        }
        return json({ error: "Method not allowed" }, 405)
      } else {
        if (
          segments.length === 5 &&
          segments[2] === "logs" &&
          segments[4] === "replay" &&
          method === "POST"
        ) {
          if (!options.webhookService)
            return json({ error: "Webhook replay is not configured" }, 500)
          const log = webhookStore.getDeliveryLog(segments[3])
          if (!log || log.webhook_id !== id)
            return json({ error: "Webhook delivery not found" }, 404)
          const replay = await options.webhookService.replayDelivery(log.id)
          return json({ ...replay, replayedFrom: log.id })
        }
        if (method === "GET") {
          // Check for /api/_webhooks/:id/logs
          if (segments.length === 3 && segments[2] === "logs") {
            return json({ data: webhookStore.getDeliveryLogs(id) })
          }
          const hook = webhookStore.getById(id)
          if (!hook) return json({ error: "Webhook not found" }, 404)
          return json(hook)
        }
        if (method === "PATCH") {
          const body = await req.json()
          const validationError = validateWebhookInput(body, true)
          if (validationError) return json({ error: validationError }, 400)
          const updated = webhookStore.update(id, body)
          if (!updated) return json({ error: "Webhook not found" }, 404)
          return json(updated)
        }
        if (method === "DELETE") {
          webhookStore.remove(id)
          return json({ deleted: true })
        }
        return json({ error: "Method not allowed" }, 405)
      }
    }

    // Settings: /api/_settings
    if (collectionName === "_settings" && settingsService) {
      const unauthorized = await requireAuthorized(req)
      if (unauthorized) return unauthorized
      const forbidden = await requireAdmin(req)
      if (forbidden) return forbidden

      if (method === "GET") {
        const prefix = url.searchParams.get("prefix") || undefined
        return json({ data: settingsService.getAll(prefix) })
      }
      if (method === "PUT" || method === "POST") {
        const body = await req.json()
        if (!isRecord(body)) return json({ error: "Settings payload must be an object" }, 400)
        for (const [key, value] of Object.entries(body)) {
          settingsService.set(key, String(value))
        }
        return json({ ok: true })
      }
      if (method === "DELETE" && id) {
        settingsService.remove(id)
        return json({ deleted: true })
      }
      return json({ error: "Method not allowed" }, 405)
    }

    // Natural-language Ask: /api/_ask?q=...
    if (collectionName === "_ask") {
      const unauthorized = await requireAuthorized(req)
      if (unauthorized) return unauthorized
      if (method !== "GET") return json({ error: "Method not allowed" }, 405)

      const q = url.searchParams.get("q") ?? ""
      const scopedCollection = url.searchParams.get("collection") ?? undefined
      if (scopedCollection && !collections.has(scopedCollection)) {
        return json({ error: `Collection '${scopedCollection}' not found` }, 404)
      }

      const role = await getRole(req)
      const result = await runAsk({
        q,
        provider: options.ask?.provider,
        embeddings: options.ask?.embeddings,
        topK: options.ask?.topK,
        collection: scopedCollection,
        fts: (term, collection) => search?.query(term, collection) ?? [],
        resolve: async (collection, documentId) => {
          const entry = collections.get(collection)
          if (!entry || !canAccessCollection(entry.def, role, "read")) return null
          const doc = await entry.service.findById(documentId)
          if (!doc) return null
          return {
            title: docTitle(doc),
            text: docText(entry.def, doc),
            href: `/content/${collection}/${documentId}`,
          }
        },
      })
      return json(result)
    }

    // Email preview: /api/_email-preview
    if (collectionName === "_email-preview") {
      const unauthorized = await requireAuthorized(req)
      if (unauthorized) return unauthorized
      if (method !== "POST") return json({ error: "Method not allowed" }, 405)

      const body = await req.json().catch(() => ({}))
      const blocks = isRecord(body) && Array.isArray(body.blocks) ? body.blocks : []
      const optionOverrides = isRecord(body) && isRecord(body.options) ? body.options : {}
      const emailOptions: EmailOptions = {
        title: stringValue(isRecord(body) ? body.title : undefined),
        fromName: stringValue(isRecord(body) ? body.byline : undefined),
        preheader: stringValue(optionOverrides.preheader),
        siteUrl: stringValue(optionOverrides.siteUrl),
        footerText: stringValue(optionOverrides.footerText),
        subjectPrefix: stringValue(optionOverrides.subjectPrefix),
      }
      const html = portableTextToEmail(
        blocks as Parameters<typeof portableTextToEmail>[0],
        emailOptions,
      )
      return json({ html })
    }

    const entry = collections.get(collectionName)
    if (!entry) {
      return json({ error: `Collection '${collectionName}' not found` }, 404)
    }

    const service = entry.service

    try {
      const project = (doc: Record<string, unknown>, role: string) =>
        projectDocumentFields(doc, entry.def.fields, role)
      const populateForRequest = async (docs: Record<string, unknown>[], role: string) =>
        populateDocuments(docs, entry.def, {
          populate: parsePopulate(url),
          role,
          collections,
          media: options.media,
        })

      // Bulk actions: /api/:collection/_bulk
      if (segments.length === 2 && id === "_bulk") {
        const unauthorized = await requireAuthorized(req)
        if (unauthorized) return unauthorized
        if (method !== "POST") return json({ error: "Method not allowed" }, 405)

        const body = await req.json()
        const ids = normalizeIdList(body.ids)
        if (ids.length === 0) return json({ error: "ids must be a non-empty array" }, 400)

        const role = await getRole(req)

        if (body.action === "update") {
          const forbidden = await requireCollectionAccess(req, entry, "update")
          if (forbidden) return forbidden
          const data =
            body.data && typeof body.data === "object" && !Array.isArray(body.data)
              ? filterWritableFields(body.data, entry.def.fields, role)
              : {}
          if ("status" in data) delete data.status
          const result = await service.bulkUpdate(ids, data)
          await recordAudit(req, {
            action: "content.bulk.updated",
            collection: collectionName,
            documentId: null,
            summary: `Bulk updated ${result.updated.length} ${collectionName}`,
            after: { ids: result.updated.map((doc) => doc.id), notFound: result.notFound },
          })
          return json({
            updated: result.updated.map((doc) => project(doc, role)),
            notFound: result.notFound,
          })
        }

        if (body.action === "workflow") {
          const forbidden = await requireCollectionAccess(req, entry, "update")
          if (forbidden) return forbidden
          if (!isWorkflowAction(body.workflowAction)) {
            return json({ error: "Unsupported workflow action" }, 400)
          }
          const result = await service.bulkTransitionStatus(ids, body.workflowAction, role)
          await recordAudit(req, {
            action: `content.bulk.workflow.${body.workflowAction}`,
            collection: collectionName,
            documentId: null,
            summary: `Bulk workflow ${body.workflowAction} for ${result.updated.length} ${collectionName}`,
            after: { ids: result.updated.map((doc) => doc.id), notFound: result.notFound },
          })
          return json({
            updated: result.updated.map((doc) => project(doc, role)),
            notFound: result.notFound,
          })
        }

        if (body.action === "delete") {
          const forbidden = await requireCollectionAccess(req, entry, "delete")
          if (forbidden) return forbidden
          const before = await Promise.all(ids.map((bulkId) => service.findById(bulkId)))
          const result = await service.bulkDelete(ids)
          await recordAudit(req, {
            action: "content.bulk.deleted",
            collection: collectionName,
            documentId: null,
            summary: `Bulk deleted ${result.deleted.length} ${collectionName}`,
            before: before.filter(Boolean),
          })
          return json(result)
        }

        if (body.action === "export") {
          const forbidden = await requireCollectionAccess(req, entry, "read")
          if (forbidden) return forbidden
          const docs = (await Promise.all(ids.map((bulkId) => service.findById(bulkId)))).filter(
            Boolean,
          ) as Record<string, unknown>[]
          const populated = await populateForRequest(docs, role)
          return json({
            data: populated.map((doc) => project(doc, role)),
            notFound: ids.filter((bulkId) => !docs.some((doc) => doc.id === bulkId)),
          })
        }

        return json({ error: "Unsupported bulk action" }, 400)
      }

      // Slug lookup: /api/:collection/slug/:slug
      if (segments.length === 3 && segments[1] === "slug") {
        const slug = segments[2]
        if (method === "GET") {
          const forbidden = await requireCollectionAccess(req, entry, "read")
          if (forbidden) return forbidden
          const role = await getRole(req)
          const populate = parsePopulate(url)
          const docs = await service.findMany({ where: { slug }, limit: 1 })
          if (docs.length === 0) return json({ error: "Not found" }, 404)
          if (publishedOnlyFor(await isAuthed(req), entry) && docs[0].status !== "published") {
            return json({ error: "Not found" }, 404)
          }
          const [doc] = await populateDocuments(docs, entry.def, {
            populate,
            role,
            collections,
            media: options.media,
          })
          return json(project(doc, role))
        }
        return json({ error: "Method not allowed" }, 405)
      }

      // Version routes: /api/:collection/:id/versions
      if (segments.length === 3 && segments[2] === "versions" && versioning) {
        const unauthorized = await requireAuthorized(req)
        if (unauthorized) return unauthorized

        const docId = segments[1]
        if (method === "GET") {
          const versions = versioning.listVersions(collectionName, docId)
          return json({ data: versions })
        }
        return json({ error: "Method not allowed" }, 405)
      }

      // Version actions: /api/:collection/:id/versions/:versionId/compare|restore
      if (segments.length === 5 && segments[2] === "versions" && versioning) {
        const unauthorized = await requireAuthorized(req)
        if (unauthorized) return unauthorized

        const docId = segments[1]
        const versionId = segments[3]
        const action = segments[4]
        const version = versioning.getVersion(versionId)
        if (!version || version.collection !== collectionName || version.document_id !== docId) {
          return json({ error: "Version not found" }, 404)
        }

        if (action === "compare" && method === "GET") {
          const forbidden = await requireCollectionAccess(req, entry, "read")
          if (forbidden) return forbidden
          const current = await service.findById(docId)
          if (!current) return json({ error: "Not found" }, 404)
          return json({ version, changes: compareVersionData(current, version.data) })
        }

        if (action === "restore" && method === "POST") {
          const forbidden = await requireCollectionAccess(req, entry, "update")
          if (forbidden) return forbidden
          const role = await getRole(req)
          const before = await service.findById(docId)
          if (!before) return json({ error: "Not found" }, 404)
          const restored = await service.update(docId, version.data, { allowStatusChange: true })
          await recordAudit(req, {
            action: "content.version.restored",
            collection: collectionName,
            documentId: docId,
            summary: `Restored ${collectionName} to v${version.version_number}`,
            before,
            after: restored,
          })
          return json(project(restored, role))
        }

        return json({ error: "Method not allowed" }, 405)
      }

      // Single version: /api/:collection/:id/versions/:versionId
      if (segments.length === 4 && segments[2] === "versions" && versioning) {
        const unauthorized = await requireAuthorized(req)
        if (unauthorized) return unauthorized

        const versionId = segments[3]
        if (method === "GET") {
          const version = versioning.getVersion(versionId)
          if (!version) return json({ error: "Version not found" }, 404)
          return json(version)
        }
        return json({ error: "Method not allowed" }, 405)
      }

      // Workflow actions: /api/:collection/:id/workflow
      if (segments.length === 3 && segments[2] === "workflow") {
        const unauthorized = await requireAuthorized(req)
        if (unauthorized) return unauthorized
        const forbidden = await requireCollectionAccess(req, entry, "update")
        if (forbidden) return forbidden

        if (method !== "POST") return json({ error: "Method not allowed" }, 405)

        const role = await getRole(req)
        const before = await service.findById(id)
        if (!before) return json({ error: "Not found" }, 404)

        const body = await req.json()
        if (!isWorkflowAction(body.action)) {
          return json({ error: "Unsupported workflow action" }, 400)
        }

        const updated = await service.transitionStatus(id, body.action, role)
        await recordAudit(req, {
          action: `content.workflow.${body.action}`,
          collection: collectionName,
          documentId: id,
          summary: workflowSummary(collectionName, body.action),
          before,
          after: updated,
        })
        return json(project(updated, role))
      }

      // Schedule publishing: /api/:collection/:id/schedule
      if (segments.length === 3 && segments[2] === "schedule") {
        const unauthorized = await requireAuthorized(req)
        if (unauthorized) return unauthorized
        const forbidden = await requireCollectionAccess(req, entry, "update")
        if (forbidden) return forbidden

        if (method !== "POST") return json({ error: "Method not allowed" }, 405)
        if (!entry.def.fields.status)
          return json({ error: "Collection does not support workflow status" }, 400)

        const publishField = getPublishField(entry.def)
        if (!publishField)
          return json({ error: "Collection does not support scheduled publishing" }, 400)

        const role = await getRole(req)
        const before = await service.findById(id)
        if (!before) return json({ error: "Not found" }, 404)

        const body = await req.json()
        const publishedAt = normalizeIsoDate(body.publishedAt ?? body.published_at)
        if (!publishedAt) return json({ error: "publishedAt must be a valid ISO timestamp" }, 400)

        const updated = await service.update(
          id,
          { [publishField]: publishedAt, status: "scheduled" },
          { allowStatusChange: true },
        )
        await recordAudit(req, {
          action: "content.scheduled",
          collection: collectionName,
          documentId: id,
          summary: `Scheduled ${collectionName}`,
          before,
          after: updated,
        })
        return json(project(updated, role))
      }

      // Collection-level routes: GET (list) and POST (create)
      if (id === null) {
        if (method === "GET") {
          const forbidden = await requireCollectionAccess(req, entry, "read")
          if (forbidden) return forbidden
          const role = await getRole(req)
          const publicOnly = publishedOnlyFor(await isAuthed(req), entry)
          const searchTerm = url.searchParams.get("search")
          if (searchTerm && search) {
            const hits = search.query(searchTerm, collectionName)
            const docs = (
              await Promise.all(hits.map((hit) => service.findById(hit.document_id)))
            ).filter(Boolean) as Record<string, unknown>[]
            const visible = publicOnly ? docs.filter((doc) => doc.status === "published") : docs
            const populated = await populateForRequest(visible, role)
            return json({ data: populated.map((doc) => project(doc, role)) })
          }

          const limit = url.searchParams.has("limit")
            ? Number(url.searchParams.get("limit"))
            : undefined
          const offset = url.searchParams.has("offset")
            ? Number(url.searchParams.get("offset"))
            : undefined
          const sort = url.searchParams.get("sort") ?? undefined
          const orderParam = url.searchParams.get("order")
          const order: "asc" | "desc" = orderParam === "desc" ? "desc" : "asc"
          const where = parseWhere(url)
          if (publicOnly) where.status = "published"

          const query = {
            limit,
            offset,
            sort,
            order,
            where: Object.keys(where).length > 0 ? where : undefined,
          }
          const [data, total] = await Promise.all([
            service.findMany(query),
            service.count({ where: query.where }),
          ])
          const populated = await populateForRequest(data, role)
          return json({
            data: populated.map((doc) => project(doc, role)),
            total,
            limit: limit ?? null,
            offset: offset ?? 0,
          })
        }

        if (method === "POST") {
          const unauthorized = await requireAuthorized(req)
          if (unauthorized) return unauthorized
          const forbidden = await requireCollectionAccess(req, entry, "create")
          if (forbidden) return forbidden

          const role = await getRole(req)
          const body = await req.json()
          const doc = await service.create(filterWritableFields(body, entry.def.fields, role))
          await recordAudit(req, {
            action: "content.created",
            collection: collectionName,
            documentId: String(doc.id),
            summary: `Created ${collectionName}`,
            after: doc,
          })
          return json(project(doc, role), 201)
        }

        if (method === "PATCH" || method === "DELETE") {
          return json({ error: "Missing document ID" }, 400)
        }

        return json({ error: "Method not allowed" }, 405)
      }

      // Document-level routes: GET, PATCH, DELETE
      if (method === "GET") {
        const forbidden = await requireCollectionAccess(req, entry, "read")
        if (forbidden) return forbidden
        const role = await getRole(req)
        const doc = await service.findById(id)
        if (!doc) {
          return json({ error: "Not found" }, 404)
        }
        if (publishedOnlyFor(await isAuthed(req), entry) && doc.status !== "published") {
          return json({ error: "Not found" }, 404)
        }
        const [populated] = await populateForRequest([doc], role)
        return json(project(populated, role))
      }

      if (method === "PATCH") {
        const unauthorized = await requireAuthorized(req)
        if (unauthorized) return unauthorized
        const forbidden = await requireCollectionAccess(req, entry, "update")
        if (forbidden) return forbidden

        const role = await getRole(req)
        const before = await service.findById(id)
        const body = await req.json()
        const updated = await service.update(id, filterWritableFields(body, entry.def.fields, role))
        await recordAudit(req, {
          action: "content.updated",
          collection: collectionName,
          documentId: id,
          summary: `Updated ${collectionName}`,
          before,
          after: updated,
        })
        return json(project(updated, role))
      }

      if (method === "DELETE") {
        const unauthorized = await requireAuthorized(req)
        if (unauthorized) return unauthorized
        const forbidden = await requireCollectionAccess(req, entry, "delete")
        if (forbidden) return forbidden

        const before = await service.findById(id)
        const deleted = await service.remove(id)
        if (deleted) {
          await recordAudit(req, {
            action: "content.deleted",
            collection: collectionName,
            documentId: id,
            summary: `Deleted ${collectionName}`,
            before,
          })
        }
        return json({ deleted })
      }

      return json({ error: "Method not allowed" }, 405)
    } catch (err: any) {
      if (err instanceof ValidationError) {
        return json({ error: err.message, issues: err.issues }, 400)
      }
      if (err instanceof QueryError) {
        return json({ error: err.message }, 400)
      }
      if (err instanceof WorkflowError) {
        return json({ error: err.message }, err.statusCode)
      }
      const message = err.message || "Internal server error"
      const status = err.message?.includes("not found") ? 404 : 500
      return json({ error: message, collection: collectionName }, status)
    }
  }
}

function validateWebhookInput(input: unknown, partial = false): string | null {
  if (!isRecord(input)) return "Webhook payload must be an object"
  if (!partial || input.url !== undefined) {
    if (typeof input.url !== "string" || !isHttpUrl(input.url))
      return "Webhook url must be an http(s) URL"
  }
  if (!partial || input.events !== undefined) {
    if (
      !Array.isArray(input.events) ||
      input.events.length === 0 ||
      input.events.some((event) => typeof event !== "string" || !event.trim())
    ) {
      return "Webhook events must be a non-empty array of event names"
    }
  }
  if (
    input.collection !== undefined &&
    input.collection !== null &&
    typeof input.collection !== "string"
  ) {
    return "Webhook collection must be a string"
  }
  if (input.secret !== undefined && input.secret !== null && typeof input.secret !== "string") {
    return "Webhook secret must be a string"
  }
  if (input.active !== undefined && typeof input.active !== "boolean") {
    return "Webhook active must be a boolean"
  }
  return null
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function parseWhere(url: URL): Record<string, unknown> {
  const where: Record<string, unknown> = {}
  const jsonWhere = url.searchParams.get("where")
  if (jsonWhere) {
    const parsed = JSON.parse(jsonWhere)
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      Object.assign(where, parsed)
    }
  }

  for (const [key, val] of url.searchParams.entries()) {
    const operatorMatch = key.match(/^where\[(.+)\]\[(.+)\]$/)
    if (operatorMatch) {
      const [, field, operator] = operatorMatch
      const current =
        typeof where[field] === "object" && where[field] !== null && !Array.isArray(where[field])
          ? (where[field] as Record<string, unknown>)
          : {}
      current[operator] = val
      where[field] = current
      continue
    }

    const match = key.match(/^where\[(.+)\]$/)
    if (match) where[match[1]] = val
  }
  return where
}

function parsePopulate(url: URL): string[] {
  return url.searchParams
    .getAll("populate")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean)
}

function getPublishField(collection: CollectionDef): "publishedAt" | "published_at" | null {
  if (collection.fields.publishedAt) return "publishedAt"
  if (collection.fields.published_at) return "published_at"
  return null
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

function normalizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .filter((id): id is string => typeof id === "string" && id.trim() !== "")
        .map((id) => id.trim()),
    ),
  )
}

function docTitle(doc: Record<string, unknown>): string {
  return String(doc.title || doc.name || doc.slug || doc.id || "Untitled")
}

function docText(collection: CollectionDef, doc: Record<string, unknown>): string {
  const parts: string[] = []
  for (const [name, field] of Object.entries(collection.fields)) {
    const value = doc[name]
    if (!value) continue
    if (field.type === "text") parts.push(String(value))
    if (field.type === "richText") parts.push(extractTextFromPortableText(value))
  }
  return parts.filter(Boolean).join("\n")
}

function workflowSummary(collection: string, action: string): string {
  switch (action) {
    case "save_draft":
      return `Saved ${collection} draft`
    case "submit_review":
      return `Submitted ${collection} for review`
    case "publish":
      return `Published ${collection}`
    case "archive":
      return `Archived ${collection}`
    default:
      return `Updated ${collection} workflow`
  }
}
