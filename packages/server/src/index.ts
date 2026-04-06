import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import {
  createDatabase,
  generateTable,
  createContentService,
  bootstrapTables,
  createVersioningService,
  type CollectionDef,
} from "@not-a-cms/core"
import { appRouter } from "./trpc/router"
import { createRestHandler } from "./rest/handler"
import { createSchemaHandler } from "./schema/handler"
import { createAuth } from "./auth/setup"
import { getSessionFromRequest } from "./auth/middleware"
import { createLocalStorage } from "./media/storage"
import { createMediaHandler } from "./media/handler"
import { collabWebSocket, type CollabWSData } from "./collab/handler"

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

  // Build collection registry
  const collections = new Map()
  for (const def of config.collections) {
    const table = generateTable(def)
    const service = createContentService(db, def, table, versioning)
    collections.set(def.name, { def, table, service })
  }

  const trpcRouter = appRouter(collections)
  const restHandler = createRestHandler(collections)
  const schemaHandler = createSchemaHandler(collections)
  const storage = createLocalStorage(config.storage ?? { provider: "local", path: "./uploads" })
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

  if (!process.env.QUIET) {
    console.log(`not-a-cms API server on http://localhost:${server.port}`)
  }

  return { server, db, collections, versioning, trpcRouter }
}

// Re-exports for external consumers
export { appRouter, type AppRouter } from "./trpc/router"
export { createRestHandler } from "./rest/handler"
export { createAuth } from "./auth/setup"
export type { ServerConfig }
