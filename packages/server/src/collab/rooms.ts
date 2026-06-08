import type { PresenceRoom } from "./presence"

export type PresenceRoomView = {
  collection: string
  documentId: string
  title: string
  users: Array<{ name: string; color: string }>
}

type ResolveTitle = (collection: string, documentId: string) => Promise<string>

function parseDocName(docName: string): { collection: string; documentId: string } | null {
  const parts = docName.split(":")
  if (parts[0] !== "content" || !parts[1] || !parts[2]) return null
  return { collection: parts[1], documentId: parts[2] }
}

export async function buildPresenceRooms(
  snapshot: PresenceRoom[],
  resolveTitle: ResolveTitle,
): Promise<PresenceRoomView[]> {
  const grouped = new Map<
    string,
    { collection: string; documentId: string; byName: Map<string, { name: string; color: string }> }
  >()
  for (const room of snapshot) {
    const parsed = parseDocName(room.docName)
    if (!parsed) continue
    const key = `${parsed.collection}:${parsed.documentId}`
    let g = grouped.get(key)
    if (!g) {
      g = { collection: parsed.collection, documentId: parsed.documentId, byName: new Map() }
      grouped.set(key, g)
    }
    for (const u of room.users) g.byName.set(u.name, { name: u.name, color: u.color })
  }

  const views: PresenceRoomView[] = []
  for (const g of grouped.values()) {
    views.push({
      collection: g.collection,
      documentId: g.documentId,
      title: await resolveTitle(g.collection, g.documentId),
      users: Array.from(g.byName.values()),
    })
  }
  return views
}
