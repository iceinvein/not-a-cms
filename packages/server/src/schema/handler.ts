import type { CollectionDef } from "@not-a-cms/core"
import { canAccessCollection, filterFieldsByRole } from "@not-a-cms/core"

type SchemaHandlerOptions = {
  getRole?: (req: Request) => string | null | Promise<string | null>
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export function createSchemaHandler(
  collections: Map<string, { def: CollectionDef }>,
  options: SchemaHandlerOptions = {},
) {
  return async function handleSchema(req: Request): Promise<Response | null> {
    const url = new URL(req.url)
    const path = url.pathname

    if (!path.startsWith("/api/_schema")) return null

    const collectionName = path.replace("/api/_schema", "").replace(/^\//, "")

    const role = (await options.getRole?.(req)) ?? "viewer"

    if (!collectionName) {
      const all = Array.from(collections.values())
        .filter(({ def }) => canAccessCollection(def, role, "read"))
        .map(({ def }) => ({
          name: def.name,
          labels: def.labels,
          fields: filterFieldsByRole(def.fields, role),
        }))
      return json({ collections: all })
    }

    const entry = collections.get(collectionName)
    if (!entry) return json({ error: `Collection '${collectionName}' not found` }, 404)
    if (!canAccessCollection(entry.def, role, "read")) {
      return json({ error: `Collection '${collectionName}' not found` }, 404)
    }

    const fields = filterFieldsByRole(entry.def.fields, role)

    return json({
      name: entry.def.name,
      labels: entry.def.labels,
      fields,
    })
  }
}
