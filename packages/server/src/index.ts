import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { sql } from "drizzle-orm"
import {
  createDatabase,
  generateTable,
  createContentService,
  bootstrapTables,
  createVersioningService,
  createSearchService,
  createEmbeddingStore,
  createScheduler,
  createWebhookStore,
  createWebhookService,
  createPreviewTokenService,
  createSettingsService,
  createRoleService,
  createAuditLogStore,
  createUserRoleStore,
  createInviteStore,
  createComponentRegistry,
  createFlowStore,
  createFlowEngine,
  createAutomationCron,
  type AskConfig,
  type CollectionDef,
  type CollectionSettings,
  type InviteRecord,
} from "@not-a-cms/core"
import { createAutomationHandler } from "./automations/handler"
import { createComponentHandler } from "./builder/component-handler"
import { appRouter } from "./trpc/router"
import { createRestHandler } from "./rest/handler"
import { createSchemaHandler } from "./schema/handler"
import { createAuth, getAuthCapabilities } from "./auth/setup"
import { getSessionFromRequest } from "./auth/middleware"
import { createMediaStorage, type MediaStorage, type StorageConfig } from "./media/storage"
import { createImageOptimizer } from "./media/optimizer"
import { createMediaHandler } from "./media/handler"
import { computeMediaUsage, computeUsageCounts } from "./media/usage"
import { collabWebSocket, presenceSnapshot, type CollabWSData } from "./collab/handler"
import { buildPresenceRooms } from "./collab/rooms"
import { createPreviewHandler } from "./preview/handler"
import { buildGraphQLSchema } from "./graphql/schema"
import { createGraphQLHandler } from "./graphql/handler"
import { createOpenAPIDocument } from "./docs/openapi"
import { buildHorizon } from "./horizon/build"

export type ServerConfig = {
  port?: number
  database: { url: string }
  email?: {
    send: (msg: { to: string; subject: string; html?: string; text?: string }) => Promise<void>
  }
  auth: {
    secret: string
    baseURL: string
    trustedOrigins?: string[]
    magicLink: {
      sendMagicLink: (params: { email: string; url: string; token: string }) => Promise<void>
    }
    oauth?: {
      github?: { clientId: string; clientSecret: string }
      google?: { clientId: string; clientSecret: string }
    }
  }
  collections: CollectionDef[]
  storage?: StorageConfig
  collaboration?: {
    requireAuth?: boolean
  }
  cors?: {
    origins: string[]
  }
  components?: Array<{
    name: string
    label: string
    category?: string
    icon?: string
    props: Record<string, any>
  }>
  testAuth?: {
    enabled: boolean
    getMagicLink: (email: string) => string | null
  }
  ai?: AskConfig
}

type CollectionRegistryEntry = {
  def: CollectionDef
  table: ReturnType<typeof generateTable>
  service: ReturnType<typeof createContentService>
}

export type CreatedServer = {
  server: Bun.Server<CollabWSData>
  db: ReturnType<typeof createDatabase>
  collections: Map<string, CollectionRegistryEntry>
  versioning: ReturnType<typeof createVersioningService>
  search: ReturnType<typeof createSearchService>
  embeddings?: ReturnType<typeof createEmbeddingStore>
  trpcRouter: ReturnType<typeof appRouter>
  webhookStore: ReturnType<typeof createWebhookStore>
  webhookService: ReturnType<typeof createWebhookService>
  previewTokenService: ReturnType<typeof createPreviewTokenService>
  settingsService: ReturnType<typeof createSettingsService>
  roleService: ReturnType<typeof createRoleService>
  auditLogStore: ReturnType<typeof createAuditLogStore>
  userRoleStore: ReturnType<typeof createUserRoleStore>
  inviteStore: ReturnType<typeof createInviteStore>
  componentRegistry: ReturnType<typeof createComponentRegistry>
  flowStore: ReturnType<typeof createFlowStore>
  flowEngine: ReturnType<typeof createFlowEngine>
  scheduler: ReturnType<typeof createScheduler>
}

export function createServer(config: ServerConfig): CreatedServer {
  const db = createDatabase(config.database)

  // Bootstrap tables for dev convenience
  bootstrapTables(db, config.collections)

  const auth = createAuth({ db, ...config.auth })
  const authCapabilities = getAuthCapabilities({ db, ...config.auth })

  const versioning = createVersioningService(db)
  const search = createSearchService(db)
  const askProvider = config.ai?.provider
  const embeddings = askProvider ? createEmbeddingStore(db) : undefined
  const webhookStore = createWebhookStore(db)
  const webhookService = createWebhookService(webhookStore)
  const settingsService = createSettingsService(db)

  const flowStore = createFlowStore(db)
  const collections = new Map<string, CollectionRegistryEntry>()
  const flowEngine = createFlowEngine(flowStore, {
    content: {
      create: async (name, data) => {
        const entry = collections.get(name)
        if (!entry) throw new Error(`Unknown collection: ${name}`)
        return entry.service.create(data, { suppressAutomations: true })
      },
      update: async (name, id, data) => {
        const entry = collections.get(name)
        if (!entry) throw new Error(`Unknown collection: ${name}`)
        return entry.service.update(id, data, { suppressAutomations: true, allowStatusChange: true })
      },
      delete: async (name, id) => {
        const entry = collections.get(name)
        if (!entry) throw new Error(`Unknown collection: ${name}`)
        return entry.service.remove(id, { suppressAutomations: true })
      },
    },
    sendEmail: config.email?.send,
  })
  const automationHandler = createAutomationHandler(flowStore, flowEngine)
  const automationCron = createAutomationCron(flowStore, flowEngine)

  // Build collection registry
  for (const def of config.collections) {
    const effectiveDef = applyCollectionSettings(def, settingsService.getCollectionSettings(def.name))
    const table = generateTable(effectiveDef)
    const embeddingHooks = askProvider && embeddings
      ? {
          index: async (collection: string, docId: string, title: string, bodyText: string) => {
            const text = `${title}\n${bodyText}`.trim()
            if (!text) return
            const [vector] = await askProvider.embed([text])
            if (!vector) return
            embeddings.upsert(collection, docId, new Float32Array(vector), askProvider.model)
          },
          remove: (collection: string, docId: string) => {
            embeddings.remove(collection, docId)
          },
        }
      : undefined
    const service = createContentService(db, effectiveDef, table, versioning, search, {
      dispatch: (event, collection, doc) => {
        const matchingFlows = flowStore.getActiveFlowsByTrigger(event)
        for (const flow of matchingFlows) {
          const trigger = flow.trigger as { type: string; collection?: string }
          if (trigger.collection && trigger.collection !== collection) continue
          flowEngine.executeFlow(flow, { event, collection, document: doc }).catch(() => {})
        }
      },
    }, embeddingHooks)
    collections.set(effectiveDef.name, { def: effectiveDef, table, service })
  }

  const roleService = createRoleService(settingsService)
  const auditLogStore = createAuditLogStore(db)
  const userRoleStore = createUserRoleStore(db)
  const inviteStore = createInviteStore(db)
  const previewTokenService = createPreviewTokenService(db)

  const getSession = (req: Request) => getSessionFromRequest(auth, req, {
    getRoleForUser: async (user) => {
      const assigned = userRoleStore.get(user.id)
      if (assigned?.active) return assigned.role
      if (!userRoleStore.hasActiveAdmin()) {
        userRoleStore.upsert({ userId: user.id, email: user.email ?? null, role: "admin", active: true })
        return "admin"
      }
      if (user.email) {
        const acceptedInvite = inviteStore.acceptByEmail(user.email, user.id)
        if (acceptedInvite) {
          userRoleStore.upsert({ userId: user.id, email: user.email, role: acceptedInvite.role, active: true })
          return acceptedInvite.role
        }
      }
      return null
    },
  })

  const previewHandler = createPreviewHandler(previewTokenService, collections, {
    getRole: async (req) => (await getSession(req))?.role ?? null,
  })

  const graphqlSchema = buildGraphQLSchema(collections)
  const graphqlHandler = createGraphQLHandler(graphqlSchema, {
    getRole: async (req) => (await getSession(req))?.role ?? null,
  })

  const storagePath = config.storage?.provider === "local" ? config.storage.path : config.storage?.path ?? "./uploads"
  const optimizer = createImageOptimizer(storagePath)
  const storage = createMediaStorage(config.storage ?? { provider: "local", path: storagePath }, optimizer)
  const mediaHandler = createMediaHandler(storage)
  const trpcRouter = appRouter(collections)
  const restHandler = createRestHandler(collections, versioning, search, webhookStore, settingsService, {
    authorize: async (req) => Boolean(await getSession(req)),
    getActor: async (req) => await getSession(req),
    getRole: async (req) => (await getSession(req))?.role ?? null,
    auditLog: auditLogStore,
    media: {
      get: (id) => {
        const record = storage.get(id)
        if (!record) return null
        const { path: _path, ...publicRecord } = record
        return { ...publicRecord, url: `/api/media/${id}/file` }
      },
    },
    webhookService,
    ask: {
      provider: askProvider,
      embeddings,
      topK: config.ai?.topK,
    },
  })
  const schemaHandler = createSchemaHandler(collections, {
    getRole: async (req) => (await getSession(req))?.role ?? null,
  })
  const componentRegistry = createComponentRegistry(config.components ?? [])
  const componentHandler = createComponentHandler(componentRegistry)
  const port = config.port ?? 4321
  const corsOrigins = new Set(config.cors?.origins ?? [])
  const requireCollabAuth = config.collaboration?.requireAuth ?? true
  const scheduler = createScheduler(collections)

  const server = Bun.serve<CollabWSData>({
    port,
    websocket: collabWebSocket,
    async fetch(req: Request, server) {
      const url = new URL(req.url)
      const origin = req.headers.get("origin")
      const corsHeaders = origin && corsOrigins.has(origin)
        ? createCorsHeaders(origin, req)
        : null
      const withCors = (res: Response): Response => {
        if (!corsHeaders) return res
        const headers = new Headers(res.headers)
        for (const [key, value] of corsHeaders) headers.set(key, value)
        const vary = headers.get("vary")
        if (!vary) {
          headers.set("vary", "Origin")
        } else if (!vary.toLowerCase().split(",").map((part) => part.trim()).includes("origin")) {
          headers.set("vary", `${vary}, Origin`)
        }
        return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
      }

      const requireAuthorized = async () => {
        const session = await getSession(req)
        return session ? null : Response.json({ error: "Unauthorized" }, { status: 401 })
      }
      const requireAdmin = async () => {
        const session = await getSession(req)
        if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })
        return session.role === "admin" ? null : Response.json({ error: "Forbidden" }, { status: 403 })
      }
      const requireEditorOrAdmin = async () => {
        const session = await getSession(req)
        if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })
        return session.role === "admin" || session.role === "editor" ? null : Response.json({ error: "Forbidden" }, { status: 403 })
      }

      if (req.method === "OPTIONS" && corsHeaders) {
        return withCors(new Response(null, { status: 204 }))
      }

      // WebSocket upgrade for collaboration
      if (url.pathname === "/collab") {
        if (requireCollabAuth) {
          const unauthorized = await requireAuthorized()
          if (unauthorized) return withCors(unauthorized)
        }

        const docName = url.searchParams.get("doc") ?? "default"
        const upgraded = server.upgrade(req, { data: { docName } as CollabWSData })
        if (upgraded) return undefined as any
        return withCors(new Response("WebSocket upgrade failed", { status: 500 }))
      }

      // Auth routes
      if (url.pathname === "/api/_auth/config") {
        return withCors(Response.json(authCapabilities))
      }

      if (url.pathname === "/api/_channel-settings") {
        if (req.method !== "GET") {
          return withCors(Response.json({ error: "Method not allowed" }, { status: 405 }))
        }
        return withCors(Response.json({ data: getPublicChannelSettings(settingsService.getAll("channel.")) }))
      }

      if (url.pathname === "/api/_docs/openapi.json") {
        if (req.method !== "GET") {
          return withCors(Response.json({ error: "Method not allowed" }, { status: 405 }))
        }
        return withCors(Response.json(createOpenAPIDocument(config.collections)))
      }

      if (config.testAuth?.enabled && process.env.E2E_TEST_AUTH === "1" && url.pathname === "/api/_test/magic-link") {
        if (req.method !== "GET") {
          return withCors(Response.json({ error: "Method not allowed" }, { status: 405 }))
        }
        const email = url.searchParams.get("email") ?? ""
        const magicLink = email ? config.testAuth.getMagicLink(email) : null
        if (!magicLink) {
          return withCors(Response.json({ error: "Magic link not found" }, { status: 404 }))
        }
        return withCors(Response.json({ url: magicLink }))
      }

      // Auth routes
      if (url.pathname === "/api/auth" || url.pathname.startsWith("/api/auth/")) {
        return withCors(await auth.handler(req))
      }

      // Schema metadata
      if (url.pathname.startsWith("/api/_schema")) {
        const res = await schemaHandler(req)
        if (res) return withCors(res)
      }

      // GraphQL
      if (url.pathname.startsWith("/graphql")) {
        return withCors(await graphqlHandler(req))
      }

      // tRPC routes
      if (url.pathname.startsWith("/trpc")) {
        const session = await getSession(req)
        return withCors(await fetchRequestHandler({
          endpoint: "/trpc",
          req,
          router: trpcRouter,
          createContext: () => ({ db, session }),
        }))
      }

      // Preview routes
      if (url.pathname.startsWith("/api/_preview")) {
        if (url.pathname === "/api/_preview/generate" || url.pathname === "/api/_preview/revoke") {
          const unauthorized = await requireAuthorized()
          if (unauthorized) return withCors(unauthorized)
        }
        const res = await previewHandler(req)
        if (res) return withCors(res)
      }

      // Component registry
      if (url.pathname.startsWith("/api/_components")) {
        const unauthorized = await requireAuthorized()
        if (unauthorized) return withCors(unauthorized)

        const res = await componentHandler(req)
        if (res) return withCors(res)
      }

      // Role registry
      if (url.pathname === "/api/_roles") {
        if (req.method === "GET") {
          const unauthorized = await requireAuthorized()
          if (unauthorized) return withCors(unauthorized)
          return withCors(Response.json({ data: roleService.listRoles() }))
        }
        if (req.method === "PUT") {
          const forbidden = await requireAdmin()
          if (forbidden) return withCors(forbidden)
          const body = await req.json()
          try {
            return withCors(Response.json({ data: roleService.saveRoles(body.roles ?? []) }))
          } catch (err: any) {
            return withCors(Response.json({ error: err.message || "Invalid role definitions" }, { status: 400 }))
          }
        }
        return withCors(Response.json({ error: "Method not allowed" }, { status: 405 }))
      }

      // Team invites
      if (url.pathname === "/api/_invites" || url.pathname.startsWith("/api/_invites/")) {
        const forbidden = await requireAdmin()
        if (forbidden) return withCors(forbidden)

        if (url.pathname === "/api/_invites" && req.method === "GET") {
          return withCors(Response.json({ data: inviteStore.listPending().map(serializeInvite) }))
        }

        if (url.pathname === "/api/_invites" && req.method === "POST") {
          const body = await req.json()
          const error = validateInviteInput(body, roleService.listRoles().map((role) => role.key))
          if (error) return withCors(Response.json({ error }, { status: 400 }))
          const created = inviteStore.create({ email: body.email, role: body.role, expiresAt: body.expiresAt })
          return withCors(Response.json({ invite: serializeInvite(created.invite), token: created.token }))
        }

        const inviteId = decodeURIComponent(url.pathname.replace("/api/_invites/", ""))
        if (inviteId && req.method === "DELETE") {
          return withCors(Response.json({ revoked: inviteStore.revoke(inviteId) }))
        }

        return withCors(Response.json({ error: "Method not allowed" }, { status: 405 }))
      }

      // Collection settings
      if (url.pathname === "/api/_collection-settings" || url.pathname.startsWith("/api/_collection-settings/")) {
        const unauthorized = await requireAuthorized()
        if (unauthorized) return withCors(unauthorized)

        if (url.pathname === "/api/_collection-settings" && req.method === "GET") {
          return withCors(Response.json({
            data: Array.from(collections.values()).map((entry) => serializeCollectionSettings(entry, settingsService)),
            roles: roleService.listRoles(),
          }))
        }

        const collectionName = decodeURIComponent(url.pathname.replace("/api/_collection-settings/", ""))
        const entry = collections.get(collectionName)
        if (!entry) return withCors(Response.json({ error: "Collection not found" }, { status: 404 }))

        if (req.method === "GET") {
          return withCors(Response.json(serializeCollectionSettings(entry, settingsService)))
        }

        if (req.method === "PUT") {
          const forbidden = await requireAdmin()
          if (forbidden) return withCors(forbidden)
          const body = await req.json()
          const validationError = validateCollectionSettingsInput(body, entry.def, roleService.listRoles().map((role) => role.key))
          if (validationError) return withCors(Response.json({ error: validationError }, { status: 400 }))
          const normalized = normalizeCollectionSettingsForSchema(body, entry.def)
          const saved = settingsService.setCollectionSettings(collectionName, normalized)
          entry.def = applyCollectionSettings(entry.def, saved)
          return withCors(Response.json(serializeCollectionSettings(entry, settingsService)))
        }

        return withCors(Response.json({ error: "Method not allowed" }, { status: 405 }))
      }

      // Team members and role assignments
      if (url.pathname === "/api/_users" || url.pathname.startsWith("/api/_users/")) {
        const forbidden = await requireAdmin()
        if (forbidden) return withCors(forbidden)

        if (url.pathname === "/api/_users" && req.method === "GET") {
          return withCors(Response.json({ data: userRoleStore.list() }))
        }

        const userId = decodeURIComponent(url.pathname.replace("/api/_users/", ""))
        if (userId && req.method === "PATCH") {
          const body = await req.json()
          const validRoles = roleService.listRoles().map((role) => role.key)
          if (typeof body.role !== "string" || !validRoles.includes(body.role)) {
            return withCors(Response.json({ error: "User role is not valid" }, { status: 400 }))
          }
          if (body.active !== undefined && typeof body.active !== "boolean") {
            return withCors(Response.json({ error: "User active flag must be a boolean" }, { status: 400 }))
          }
          const updated = userRoleStore.upsert({
            userId,
            email: body.email ?? null,
            role: body.role,
            active: body.active ?? true,
          })
          return withCors(Response.json(updated))
        }

        return withCors(Response.json({ error: "Method not allowed" }, { status: 405 }))
      }

      // Audit log
      if (url.pathname === "/api/_audit") {
        const forbidden = await requireAdmin()
        if (forbidden) return withCors(forbidden)
        const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined
        const offset = url.searchParams.has("offset") ? Number(url.searchParams.get("offset")) : undefined
        return withCors(Response.json({
          data: auditLogStore.list({
            collection: url.searchParams.get("collection") ?? undefined,
            documentId: url.searchParams.get("documentId") ?? undefined,
            limit,
            offset,
          }),
        }))
      }

      // Dashboard metrics
      if (url.pathname === "/api/_metrics") {
        const unauthorized = await requireAuthorized()
        if (unauthorized) return withCors(unauthorized)
        return withCors(Response.json(await buildDashboardMetrics(collections, storage, auditLogStore)))
      }

      // Publishing horizon
      if (url.pathname === "/api/_horizon") {
        const unauthorized = await requireAuthorized()
        if (unauthorized) return withCors(unauthorized)
        return withCors(Response.json(await buildHorizon(collections, new Date())))
      }

      // Live presence
      if (url.pathname === "/api/_presence") {
        if (req.method !== "GET") {
          return withCors(Response.json({ error: "Method not allowed" }, { status: 405 }))
        }
        const unauthorized = await requireAuthorized()
        if (unauthorized) return withCors(unauthorized)
        const resolveTitle = async (collection: string, documentId: string) => {
          const entry = collections.get(collection)
          if (!entry) return documentId
          const doc = await entry.service.findById(documentId).catch(() => null)
          return doc ? String((doc as any).title || (doc as any).name || (doc as any).slug || documentId) : documentId
        }
        return withCors(Response.json({ rooms: await buildPresenceRooms(presenceSnapshot(), resolveTitle) }))
      }

      // Media usage counts for Vault clustering
      if (url.pathname === "/api/media/usage") {
        if (req.method !== "GET") {
          return withCors(Response.json({ error: "Method not allowed" }, { status: 405 }))
        }
        const unauthorized = await requireAuthorized()
        if (unauthorized) return withCors(unauthorized)

        const countFn = async (table: string, column: string) => {
          const quotedTable = quoteIdentifier(table)
          const quotedColumn = quoteIdentifier(column)
          const rows = db.all(sql.raw(`SELECT ${quotedColumn} AS aid, COUNT(*) AS n FROM ${quotedTable} WHERE ${quotedColumn} IS NOT NULL GROUP BY ${quotedColumn}`)) as { aid: string; n: number }[]
          const counts: Record<string, number> = {}
          for (const row of rows) counts[String(row.aid)] = Number(row.n)
          return counts
        }

        return withCors(Response.json({ counts: await computeUsageCounts(collections, countFn) }))
      }

      // Media usage detail for one asset
      const mediaUsageMatch = url.pathname.match(/^\/api\/media\/([^/]+)\/usage$/)
      if (mediaUsageMatch) {
        if (req.method !== "GET") {
          return withCors(Response.json({ error: "Method not allowed" }, { status: 405 }))
        }
        const unauthorized = await requireAuthorized()
        if (unauthorized) return withCors(unauthorized)

        const assetId = decodeURIComponent(mediaUsageMatch[1])
        const queryFn = async (table: string, column: string, id: string) => {
          const quotedTable = quoteIdentifier(table)
          const quotedColumn = quoteIdentifier(column)
          return db.all(sql`${sql.raw(`SELECT * FROM ${quotedTable} WHERE ${quotedColumn} = `)}${id}`) as any[]
        }

        return withCors(Response.json(await computeMediaUsage(collections, assetId, queryFn)))
      }

      // Media routes
      if (url.pathname.startsWith("/api/media")) {
        if (req.method === "GET" && /^\/api\/media\/[^/]+\/file$/.test(url.pathname)) {
          const res = await mediaHandler(req)
          if (res) return withCors(res)
        }

        const unauthorized = await requireAuthorized()
        if (unauthorized) return withCors(unauthorized)
        if (req.method === "POST" || req.method === "DELETE") {
          const forbidden = await requireEditorOrAdmin()
          if (forbidden) return withCors(forbidden)
        }

        const res = await mediaHandler(req)
        if (res) return withCors(res)
      }

      // Automation routes
      if (url.pathname.startsWith("/api/_flows")) {
        const forbidden = await requireAdmin()
        if (forbidden) return withCors(forbidden)

        const res = await automationHandler(req)
        if (res) return withCors(res)
      }

      // Scheduled publishing
      if (url.pathname === "/api/_scheduler/run") {
        if (req.method !== "POST") return withCors(Response.json({ error: "Method not allowed" }, { status: 405 }))
        const forbidden = await requireAdmin()
        if (forbidden) return withCors(forbidden)
        const promoted = await scheduler.promoteScheduled()
        return withCors(Response.json({ promoted }))
      }

      // REST routes
      if (url.pathname.startsWith("/api/")) {
        const res = await restHandler(req)
        if (res) return withCors(res)
      }

      // Health check
      if (url.pathname === "/health") {
        return withCors(Response.json({ status: "ok" }))
      }

      return withCors(new Response("Not Found", { status: 404 }))
    },
  })

  setInterval(async () => {
    try {
      const promoted = await scheduler.promoteScheduled()
      if (promoted.length > 0 && !process.env.QUIET) {
        console.log(`  Scheduled publishing: promoted ${promoted.length} post(s)`)
      }
    } catch {}
    try {
      await automationCron.tick()
    } catch {}
  }, 60_000)

  if (!process.env.QUIET) {
    console.log(`not-a-cms API server on http://localhost:${server.port}`)
  }

  return { server, db, collections, versioning, search, embeddings, trpcRouter, webhookStore, webhookService, previewTokenService, settingsService, roleService, auditLogStore, userRoleStore, inviteStore, componentRegistry, flowStore, flowEngine, scheduler }
}

// Re-exports for external consumers
export { appRouter, type AppRouter } from "./trpc/router"
export {
  createNotACMSTRPCClient,
  resolveTRPCUrl,
  type CreateNotACMSTRPCClientOptions,
  type NotACMSTRPCClient,
} from "./trpc/client"
export { createRestHandler } from "./rest/handler"
export { createAuth } from "./auth/setup"

function createCorsHeaders(origin: string, req: Request): Headers {
  const headers = new Headers()
  headers.set("access-control-allow-origin", origin)
  headers.set("access-control-allow-credentials", "true")
  headers.set("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
  headers.set("access-control-allow-headers", req.headers.get("access-control-request-headers") ?? "content-type, authorization")
  headers.set("access-control-max-age", "600")
  return headers
}

function applyCollectionSettings(def: CollectionDef, settings: CollectionSettings): CollectionDef {
  return {
    ...def,
    labels: {
      singular: settings.labels?.singular ?? def.labels.singular,
      plural: settings.labels?.plural ?? def.labels.plural,
    },
    ...(settings.access ? { access: settings.access } : {}),
    fields: def.fields,
  }
}

function serializeCollectionSettings(
  entry: CollectionRegistryEntry,
  settingsService: ReturnType<typeof createSettingsService>,
) {
  return {
    name: entry.def.name,
    labels: entry.def.labels,
    fields: entry.def.fields,
    settings: settingsService.getCollectionSettings(entry.def.name),
  }
}

function serializeInvite(invite: InviteRecord) {
  const { tokenHash: _tokenHash, ...publicInvite } = invite
  return publicInvite
}

function getPublicChannelSettings(settings: Record<string, string>): Record<string, string> {
  const allowed = new Set([
    "channel.rss.title",
    "channel.rss.description",
    "channel.rss.language",
    "channel.rss.collection",
    "channel.rss.itemPath",
    "channel.email.title",
    "channel.email.preheader",
    "channel.email.footerText",
    "channel.email.fromName",
    "channel.email.subjectPrefix",
  ])
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(settings)) {
    if (allowed.has(key)) result[key] = value
  }
  return result
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll("\"", "\"\"")}"`
}

function validateInviteInput(input: unknown, roleKeys: string[]): string | null {
  if (!isRecord(input)) return "Invite must be an object"
  if (typeof input.email !== "string" || !input.email.trim() || !input.email.includes("@")) {
    return "Invite email is required"
  }
  if (typeof input.role !== "string" || !roleKeys.includes(input.role)) {
    return "Invite role is not valid"
  }
  if (input.expiresAt !== undefined && Number.isNaN(new Date(String(input.expiresAt)).getTime())) {
    return "Invite expiry is not valid"
  }
  return null
}

async function buildDashboardMetrics(
  collections: Map<string, CollectionRegistryEntry>,
  storage: MediaStorage,
  auditLogStore: ReturnType<typeof createAuditLogStore>,
) {
  const collectionMetrics = await Promise.all(Array.from(collections.values()).map(async (entry) => {
    const hasStatus = Boolean(entry.def.fields.status)
    const [total, drafts, inReview, published, scheduled] = await Promise.all([
      entry.service.count(),
      hasStatus ? entry.service.count({ where: { status: "draft" } }) : Promise.resolve(0),
      hasStatus ? entry.service.count({ where: { status: "in_review" } }) : Promise.resolve(0),
      hasStatus ? entry.service.count({ where: { status: "published" } }) : Promise.resolve(0),
      hasStatus ? entry.service.count({ where: { status: "scheduled" } }) : Promise.resolve(0),
    ])
    return {
      name: entry.def.name,
      label: entry.def.labels.plural,
      total,
      drafts,
      inReview,
      published,
      scheduled,
    }
  }))

  return {
    collections: collectionMetrics,
    totals: {
      content: collectionMetrics.reduce((sum, item) => sum + item.total, 0),
      drafts: collectionMetrics.reduce((sum, item) => sum + item.drafts, 0),
      inReview: collectionMetrics.reduce((sum, item) => sum + item.inReview, 0),
      published: collectionMetrics.reduce((sum, item) => sum + item.published, 0),
      scheduled: collectionMetrics.reduce((sum, item) => sum + item.scheduled, 0),
    },
    media: { total: storage.list().length },
    recentAudit: auditLogStore.list({ limit: 5 }),
  }
}

function validateCollectionSettingsInput(input: unknown, def: CollectionDef, roleKeys: string[]): string | null {
  if (!isRecord(input)) return "Collection settings must be an object"
  const validRoles = new Set(roleKeys)
  if (isRecord(input.access)) {
    for (const value of Object.values(input.access)) {
      if (!Array.isArray(value)) continue
      for (const role of value) {
        if (typeof role !== "string" || !validRoles.has(role)) {
          return `Unknown role "${String(role)}"`
        }
      }
    }
  }
  if (Array.isArray(input.searchFields)) {
    for (const field of input.searchFields) {
      if (typeof field === "string" && field.trim() && !def.fields[field.trim()]) {
        continue
      }
    }
  }
  return null
}

function normalizeCollectionSettingsForSchema(input: Record<string, unknown>, def: CollectionDef): CollectionSettings {
  const searchFields = Array.isArray(input.searchFields)
    ? input.searchFields.filter((field): field is string => typeof field === "string" && Boolean(def.fields[field.trim()])).map((field) => field.trim())
    : undefined
  return {
    ...(isRecord(input.labels) && { labels: input.labels as CollectionSettings["labels"] }),
    ...(isRecord(input.access) && { access: input.access as CollectionSettings["access"] }),
    ...(typeof input.previewPath === "string" && { previewPath: input.previewPath }),
    ...(searchFields !== undefined && { searchFields }),
    ...(typeof input.editorLayout === "string" && { editorLayout: input.editorLayout }),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
