import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import {
  createDatabase,
  generateTable,
  createContentService,
  bootstrapTables,
  createVersioningService,
  createSearchService,
  createScheduler,
  createWebhookStore,
  createWebhookService,
  createPreviewTokenService,
  type CollectionDef,
} from "@not-a-cms/core"
import { appRouter } from "./trpc/router"
import { createRestHandler } from "./rest/handler"
import { createSchemaHandler } from "./schema/handler"
import { createAuth } from "./auth/setup"
import { getSessionFromRequest } from "./auth/middleware"
import { createLocalStorage } from "./media/storage"
import { createImageOptimizer } from "./media/optimizer"
import { createMediaHandler } from "./media/handler"
import { collabWebSocket, type CollabWSData } from "./collab/handler"
import { createPreviewHandler } from "./preview/handler"
import { buildGraphQLSchema } from "./graphql/schema"
import { createGraphQLHandler } from "./graphql/handler"

type ServerConfig = {
  port?: number
  database: { url: string }
  auth: {
    secret: string
    baseURL: string
    magicLink: {
      sendMagicLink: (params: { email: string; url: string; token: string }) => Promise<void>
    }
  }
  collections: CollectionDef[]
  storage?: { provider: "local"; path: string }
}

export function createServer(config: ServerConfig) {
  const db = createDatabase(config.database)
  const auth = createAuth({ db, ...config.auth })

  // Bootstrap tables for dev convenience
  bootstrapTables(db, config.collections)

  const versioning = createVersioningService(db)
  const search = createSearchService(db)
  const webhookStore = createWebhookStore(db)
  const webhookService = createWebhookService(webhookStore)

  // Build collection registry
  const collections = new Map()
  for (const def of config.collections) {
    const table = generateTable(def)
    const service = createContentService(db, def, table, versioning, search)
    collections.set(def.name, { def, table, service })
  }

  const previewTokenService = createPreviewTokenService(db)
  const previewHandler = createPreviewHandler(previewTokenService, collections)

  const graphqlSchema = buildGraphQLSchema(collections)
  const graphqlHandler = createGraphQLHandler(graphqlSchema)

  const trpcRouter = appRouter(collections)
  const restHandler = createRestHandler(collections, versioning, search, webhookStore)
  const schemaHandler = createSchemaHandler(collections)
  const storagePath = config.storage?.path ?? "./uploads"
  const optimizer = createImageOptimizer(storagePath)
  const storage = createLocalStorage(config.storage ?? { provider: "local", path: storagePath }, optimizer)
  const mediaHandler = createMediaHandler(storage)
  const port = config.port ?? 4321

  const server = Bun.serve<CollabWSData>({
    port,
    websocket: collabWebSocket,
    async fetch(req: Request, server) {
      const url = new URL(req.url)

      // WebSocket upgrade for collaboration
      if (url.pathname === "/collab") {
        const docName = url.searchParams.get("doc") ?? "default"
        const upgraded = server.upgrade<CollabWSData>(req, { data: { docName } })
        if (upgraded) return undefined as any
        return new Response("WebSocket upgrade failed", { status: 500 })
      }

      // Auth routes
      if (url.pathname.startsWith("/api/auth")) {
        return auth.handler(req)
      }

      // Schema metadata
      if (url.pathname.startsWith("/api/_schema")) {
        const res = await schemaHandler(req)
        if (res) return res
      }

      // GraphQL
      if (url.pathname.startsWith("/graphql")) {
        return graphqlHandler(req)
      }

      // tRPC routes
      if (url.pathname.startsWith("/trpc")) {
        const session = await getSessionFromRequest(auth, req)
        return fetchRequestHandler({
          endpoint: "/trpc",
          req,
          router: trpcRouter,
          createContext: () => ({ db, session }),
        })
      }

      // Preview routes
      if (url.pathname.startsWith("/api/_preview")) {
        const res = await previewHandler(req)
        if (res) return res
      }

      // Media routes
      if (url.pathname.startsWith("/api/media")) {
        const res = await mediaHandler(req)
        if (res) return res
      }

      // REST routes
      if (url.pathname.startsWith("/api/")) {
        const res = await restHandler(req)
        if (res) return res
      }

      // Health check
      if (url.pathname === "/health") {
        return Response.json({ status: "ok" })
      }

      return new Response("Not Found", { status: 404 })
    },
  })

  const scheduler = createScheduler(collections)
  setInterval(async () => {
    try {
      const promoted = await scheduler.promoteScheduled()
      if (promoted.length > 0 && !process.env.QUIET) {
        console.log(`  Scheduled publishing: promoted ${promoted.length} post(s)`)
      }
    } catch {}
  }, 60_000)

  if (!process.env.QUIET) {
    console.log(`not-a-cms API server on http://localhost:${server.port}`)
  }

  return { server, db, collections, versioning, search, trpcRouter, webhookStore, webhookService, previewTokenService }
}

// Re-exports for external consumers
export { appRouter, type AppRouter } from "./trpc/router"
export { createRestHandler } from "./rest/handler"
export { createAuth } from "./auth/setup"
export type { ServerConfig }
