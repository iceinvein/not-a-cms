import type { ComponentRegistry } from "@not-a-cms/core"

export function createComponentHandler(registry: ComponentRegistry) {
  return async function handleComponentRequest(req: Request): Promise<Response | null> {
    const url = new URL(req.url)
    if (!url.pathname.startsWith("/api/_components")) return null
    if (req.method !== "GET") return null

    // GET /api/_components/:name
    const nameMatch = url.pathname.match(/^\/api\/_components\/(.+)$/)
    if (nameMatch) {
      const name = nameMatch[1]
      const component = registry.get(name)
      if (!component) return Response.json({ error: "Component not found" }, { status: 404 })
      return Response.json(component)
    }

    // GET /api/_components
    const grouped = url.searchParams.get("grouped")
    if (grouped === "true") {
      return Response.json(registry.listByCategory())
    }
    return Response.json(registry.list())
  }
}
