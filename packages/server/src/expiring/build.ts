type Entry = {
  def: { name: string; labels?: { plural?: string }; fields: Record<string, { type: string }> }
  service: { findMany(args: any): Promise<Record<string, unknown>[]> | Record<string, unknown>[] }
}

export type ExpiringItem = {
  collection: string
  documentId: string
  title: string
  unpublishAt: string
}

function unpublishField(fields: Record<string, { type: string }>): string | null {
  if (fields.unpublishAt) return "unpublishAt"
  if (fields.unpublish_at) return "unpublish_at"
  return null
}

function title(doc: Record<string, unknown>): string {
  return String(doc.title || doc.name || doc.slug || doc.id)
}

export async function buildExpiring(collections: Map<string, Entry>, now: Date, windowDays = 7): Promise<ExpiringItem[]> {
  const nowMs = now.getTime()
  const endMs = nowMs + windowDays * 24 * 60 * 60 * 1000
  const items: ExpiringItem[] = []

  for (const [name, entry] of collections) {
    const field = unpublishField(entry.def.fields)
    if (!entry.def.fields.status || !field) continue

    const docs = await entry.service.findMany({ where: { status: { in: ["published"] } } })
    for (const doc of docs) {
      const raw = (doc.unpublishAt ?? doc.unpublish_at) as string | null
      if (!raw) continue
      const t = new Date(raw).getTime()
      if (Number.isNaN(t) || t <= nowMs || t > endMs) continue
      items.push({ collection: name, documentId: String(doc.id), title: title(doc), unpublishAt: raw })
    }
  }

  return items.sort((a, b) => new Date(a.unpublishAt).getTime() - new Date(b.unpublishAt).getTime())
}
