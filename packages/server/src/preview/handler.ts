import type { createContentService, PreviewTokenService } from "@not-a-cms/core"
import { canAccessCollection } from "@not-a-cms/core"

type CollectionEntry = {
  def: any
  table: any
  service: ReturnType<typeof createContentService>
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export function createPreviewHandler(
  tokenService: PreviewTokenService,
  collections: Map<string, CollectionEntry>,
  options: {
    getRole?: (req: Request) => string | null | Promise<string | null>
  } = {},
) {
  return async function handler(req: Request): Promise<Response | null> {
    const url = new URL(req.url)

    // POST /api/_preview/generate — create a preview token
    if (url.pathname === "/api/_preview/generate" && req.method === "POST") {
      const body = await req.json()
      const { collection, documentId } = body
      if (!collection || !documentId) {
        return json({ error: "collection and documentId required" }, 400)
      }
      const entry = collections.get(collection)
      if (!entry) return json({ error: "Collection not found" }, 404)
      const role = await getRole(req)
      if (!canAccessCollection(entry.def, role, "update")) return json({ error: "Forbidden" }, 403)
      const doc = await entry.service.findById(documentId)
      if (!doc) return json({ error: "Document not found" }, 404)

      const token = tokenService.generate(collection, documentId, {
        regenerate: body.regenerate === true,
      })
      const previewUrl = `${url.origin}/api/_preview/${token.token}`
      return json({ ...token, previewUrl })
    }

    // POST /api/_preview/revoke — revoke active preview tokens for a document
    if (url.pathname === "/api/_preview/revoke" && req.method === "POST") {
      const body = await req.json()
      const { collection, documentId } = body
      if (!collection || !documentId) {
        return json({ error: "collection and documentId required" }, 400)
      }
      const entry = collections.get(collection)
      if (!entry) return json({ error: "Collection not found" }, 404)
      const role = await getRole(req)
      if (!canAccessCollection(entry.def, role, "update")) return json({ error: "Forbidden" }, 403)

      const revoked = tokenService.revoke(collection, documentId)
      return json({ revoked })
    }

    // GET /api/_preview/validate/:token — validate and return document
    if (url.pathname.startsWith("/api/_preview/validate/") && req.method === "GET") {
      const token = url.pathname.split("/").pop()
      if (!token) return json({ error: "Token required" }, 400)

      const result = tokenService.validate(token, {
        collection: url.searchParams.get("collection") ?? undefined,
        documentId: url.searchParams.get("documentId") ?? undefined,
      })
      if (!result) return json({ error: "Invalid or expired preview token" }, 403)

      const entry = collections.get(result.collection)
      if (!entry) return json({ error: "Collection not found" }, 404)

      const doc = await entry.service.findById(result.document_id)
      if (!doc) return json({ error: "Document not found" }, 404)

      return json({ ...doc, _preview: true, _collection: result.collection })
    }

    return null
  }

  async function getRole(req: Request): Promise<string> {
    return (await options.getRole?.(req)) ?? "viewer"
  }
}
