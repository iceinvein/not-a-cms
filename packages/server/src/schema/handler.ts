import type { CollectionDef } from "@not-a-cms/core"
import { filterFieldsByRole } from "@not-a-cms/core"

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export function createSchemaHandler(collections: Map<string, { def: CollectionDef }>) {
  return async function handleSchema(req: Request): Promise<Response | null> {
    const url = new URL(req.url)
    const path = url.pathname

    if (!path.startsWith("/api/_schema")) return null

    const collectionName = path.replace("/api/_schema", "").replace(/^\//, "")

    const role = url.searchParams.get("role")

    if (!collectionName) {
      const all = Array.from(collections.values()).map(({ def }) => ({
        name: def.name,
        labels: def.labels,
        fields: role ? filterFieldsByRole(def.fields, role) : def.fields,
      }))
      return json({ collections: all })
    }

    const entry = collections.get(collectionName)
    if (!entry) return json({ error: `Collection '${collectionName}' not found` }, 404)

    const fields = role ? filterFieldsByRole(entry.def.fields, role) : entry.def.fields

    return json({
      name: entry.def.name,
      labels: entry.def.labels,
      fields,
    })
  }
}
