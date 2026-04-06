import type { CollectionDef, VersioningService } from "@not-a-cms/core"
import type { createContentService } from "@not-a-cms/core"

export type CollectionEntry = {
  def: CollectionDef
  table: any
  service: ReturnType<typeof createContentService>
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
  search?: { query: (term: string, collection?: string) => Array<{ collection: string; document_id: string }> },
) {
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

    const entry = collections.get(collectionName)
    if (!entry) {
      return json({ error: `Collection '${collectionName}' not found` }, 404)
    }

    const service = entry.service
    const method = req.method.toUpperCase()

    try {
      // Slug lookup: /api/:collection/slug/:slug
      if (segments.length === 3 && segments[1] === "slug") {
        const slug = segments[2]
        if (method === "GET") {
          const docs = await service.findMany({ where: { slug }, limit: 1 })
          if (docs.length === 0) return json({ error: "Not found" }, 404)
          return json(docs[0])
        }
        return json({ error: "Method not allowed" }, 405)
      }

      // Version routes: /api/:collection/:id/versions
      if (segments.length === 3 && segments[2] === "versions" && versioning) {
        const docId = segments[1]
        if (method === "GET") {
          const versions = versioning.listVersions(collectionName, docId)
          return json({ data: versions })
        }
        return json({ error: "Method not allowed" }, 405)
      }

      // Single version: /api/:collection/:id/versions/:versionId
      if (segments.length === 4 && segments[2] === "versions" && versioning) {
        const versionId = segments[3]
        if (method === "GET") {
          const version = versioning.getVersion(versionId)
          if (!version) return json({ error: "Version not found" }, 404)
          return json(version)
        }
        return json({ error: "Method not allowed" }, 405)
      }

      // Collection-level routes: GET (list) and POST (create)
      if (id === null) {
        if (method === "GET") {
          const searchTerm = url.searchParams.get("search")
          if (searchTerm && search) {
            const hits = search.query(searchTerm, collectionName)
            const docs = await Promise.all(
              hits.map((hit) => service.findById(hit.document_id)),
            )
            return json({ data: docs.filter(Boolean) })
          }

          const limit = url.searchParams.has("limit")
            ? Number(url.searchParams.get("limit"))
            : undefined
          const offset = url.searchParams.has("offset")
            ? Number(url.searchParams.get("offset"))
            : undefined

          // Where filters from query params
          const where: Record<string, unknown> = {}
          for (const [key, val] of url.searchParams.entries()) {
            const match = key.match(/^where\[(.+)\]$/)
            if (match) where[match[1]] = val
          }

          const data = await service.findMany({ limit, offset, where: Object.keys(where).length > 0 ? where : undefined })
          return json({ data })
        }

        if (method === "POST") {
          const body = await req.json()
          const doc = await service.create(body)
          return json(doc, 201)
        }

        if (method === "PATCH" || method === "DELETE") {
          return json({ error: "Missing document ID" }, 400)
        }

        return json({ error: "Method not allowed" }, 405)
      }

      // Document-level routes: GET, PATCH, DELETE
      if (method === "GET") {
        const doc = await service.findById(id)
        if (!doc) {
          return json({ error: "Not found" }, 404)
        }
        return json(doc)
      }

      if (method === "PATCH") {
        const body = await req.json()
        const updated = await service.update(id, body)
        return json(updated)
      }

      if (method === "DELETE") {
        const deleted = await service.remove(id)
        return json({ deleted })
      }

      return json({ error: "Method not allowed" }, 405)
    } catch (err: any) {
      const message = err.message || "Internal server error"
      const status = err.message?.includes("not found") ? 404 : 500
      return json({ error: message, collection: collectionName }, status)
    }
  }
}
