import type { PresenceRoomView } from "../desk/live"

/** A person for the spine avatars. Structurally compatible with PresenceDots' PresencePerson. */
export type SpinePerson = { id: string; name: string; color: string }

/** Flatten presence rooms into a deduped, name-sorted person list. A user
 *  editing several documents appears once. */
export function presenceToPeople(rooms: PresenceRoomView[]): SpinePerson[] {
  const byName = new Map<string, SpinePerson>()
  for (const room of rooms) {
    for (const u of room.users) {
      if (!byName.has(u.name)) byName.set(u.name, { id: u.name, name: u.name, color: u.color })
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}
