export type PresenceUser = { name: string; color: string }
export type PresenceMessage = {
  type: "presence"
  clientId: string
  user: PresenceUser
  status: "online" | "offline"
}
export type PresenceRoom = { docName: string; users: Array<{ clientId: string } & PresenceUser> }

export class PresenceRegistry {
  private rooms = new Map<string, Map<string, PresenceUser>>()

  join(docName: string, clientId: string, user: PresenceUser): void {
    let room = this.rooms.get(docName)
    if (!room) {
      room = new Map()
      this.rooms.set(docName, room)
    }
    room.set(clientId, user)
  }

  leave(docName: string, clientId: string): void {
    const room = this.rooms.get(docName)
    if (!room) return
    room.delete(clientId)
    if (room.size === 0) this.rooms.delete(docName)
  }

  applyPresence(docName: string, msg: PresenceMessage): void {
    if (msg.status === "online") this.join(docName, msg.clientId, msg.user)
    else this.leave(docName, msg.clientId)
  }

  snapshot(): PresenceRoom[] {
    const out: PresenceRoom[] = []
    for (const [docName, room] of this.rooms) {
      out.push({
        docName,
        users: Array.from(room.entries()).map(([clientId, user]) => ({ clientId, ...user })),
      })
    }
    return out
  }
}
