import type { PresenceRoomView } from "../desk/live"
import type { SpinePerson } from "./presence"
import type { StatusKind } from "./types"

const STATUS_SIGNALS: Record<string, StatusKind> = {
  draft: "draft",
  in_review: "in_review",
  published: "published",
  scheduled: "scheduled",
  archived: "dormant",
}

/** Map a content status string to the StatusSignal kind it should render. */
export function statusToSignal(status: string | undefined): StatusKind {
  return (status && STATUS_SIGNALS[status]) || "draft"
}

/** The scheduled/publish datetime for a content item, if any (collection-dependent key). */
export function scheduledAt(item: Record<string, unknown>): string | undefined {
  const value = item.publishedAt ?? item.published_at
  return typeof value === "string" ? value : undefined
}

/** Group deduped presence people by document id, limited to one collection. */
export function presenceByDocument(
  rooms: PresenceRoomView[],
  collection: string,
): Record<string, SpinePerson[]> {
  const byDoc: Record<string, SpinePerson[]> = {}
  for (const room of rooms) {
    if (room.collection !== collection) continue
    const seen = new Set<string>()
    const people: SpinePerson[] = []
    for (const u of room.users) {
      if (seen.has(u.name)) continue
      seen.add(u.name)
      people.push({ id: u.name, name: u.name, color: u.color })
    }
    if (people.length > 0) byDoc[room.documentId] = people
  }
  return byDoc
}
