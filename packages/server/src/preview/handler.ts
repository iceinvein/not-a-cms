import type { PreviewTokenService } from "@not-a-cms/core"
import type { createContentService } from "@not-a-cms/core"

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
      const token = tokenService.generate(collection, documentId)
      const previewUrl = `${url.origin}/api/_preview/${token.token}`
      return json({ ...token, previewUrl })
    }

    // GET /api/_preview/validate/:token — validate and return document
    if (url.pathname.startsWith("/api/_preview/validate/") && req.method === "GET") {
      const token = url.pathname.split("/").pop()
      if (!token) return json({ error: "Token required" }, 400)

      const result = tokenService.validate(token)
      if (!result) return json({ error: "Invalid or expired preview token" }, 403)

      const entry = collections.get(result.collection)
      if (!entry) return json({ error: "Collection not found" }, 404)

      const doc = await entry.service.findById(result.document_id)
      if (!doc) return json({ error: "Document not found" }, 404)

      return json({ ...doc, _preview: true, _collection: result.collection })
    }

    return null
  }
}
