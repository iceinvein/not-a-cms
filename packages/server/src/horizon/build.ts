import { bucketHorizon, type Horizon, type HorizonItem } from "@not-a-cms/core"

type Entry = {
  def: {
    name: string
    labels?: { singular: string; plural: string }
    fields: Record<string, { type: string }>
  }
  service: {
    findMany(args: unknown): Promise<Record<string, unknown>[]> | Record<string, unknown>[]
  }
}

function publishField(fields: Record<string, { type: string }>): string | null {
  if (fields.publishedAt) return "publishedAt"
  if (fields.published_at) return "published_at"
  return null
}

function title(doc: Record<string, unknown>): string {
  return String(doc.title || doc.name || doc.slug || doc.id)
}

export async function buildHorizon(collections: Map<string, Entry>, now: Date): Promise<Horizon> {
  const items: HorizonItem[] = []
  for (const [name, entry] of collections) {
    const field = publishField(entry.def.fields)
    if (!entry.def.fields.status || !field) continue

    const docs = await entry.service.findMany({
      where: { status: { in: ["scheduled"] } },
      sort: field,
      order: "asc",
      limit: 50,
    })
    for (const doc of docs) {
      items.push({
        collection: name,
        documentId: String(doc.id),
        title: title(doc),
        publishedAt: (doc.publishedAt ?? doc.published_at ?? null) as string | null,
        status: String(doc.status),
      })
    }
  }
  return bucketHorizon(items, now)
}
