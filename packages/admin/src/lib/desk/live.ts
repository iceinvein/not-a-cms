export type PresenceRoomView = {
  collection: string
  documentId: string
  title: string
  users: Array<{ name: string; color: string }>
}
export type LiveRow = {
  name: string
  color: string
  title: string
  href: string
  collection: string
  documentId: string
}

export function toLiveRows(rooms: PresenceRoomView[]): LiveRow[] {
  const rows: LiveRow[] = []
  for (const room of rooms) {
    for (const u of room.users) {
      rows.push({
        name: u.name,
        color: u.color,
        title: room.title,
        href: `/content/${room.collection}/${room.documentId}`,
        collection: room.collection,
        documentId: room.documentId,
      })
    }
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name))
}
