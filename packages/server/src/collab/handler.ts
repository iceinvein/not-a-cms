import * as Y from "yjs"
import { type PresenceMessage, PresenceRegistry, type PresenceUser } from "./presence"

const docs = new Map<string, Y.Doc>()
const presence = new PresenceRegistry()

export function getOrCreateDoc(docName: string): Y.Doc {
  if (!docs.has(docName)) {
    docs.set(docName, new Y.Doc())
  }
  return docs.get(docName)!
}

export type CollabWSData = {
  docName: string
  clientId?: string
  user?: PresenceUser
}

export function presenceSnapshot() {
  return presence.snapshot()
}

export const collabWebSocket = {
  open(ws: any) {
    const { docName } = ws.data as CollabWSData
    const doc = getOrCreateDoc(docName)
    const state = Y.encodeStateAsUpdate(doc)
    ws.send(state)
    ws.subscribe(docName)
  },

  message(ws: any, message: string | Buffer) {
    const data = ws.data as CollabWSData
    const { docName } = data
    if (typeof message === "string" && isPresenceMessage(message)) {
      const msg = JSON.parse(message) as PresenceMessage
      data.clientId = msg.clientId
      data.user = msg.user
      presence.applyPresence(docName, msg)
      ws.publish(docName, message)
      return
    }

    if (typeof message === "string" && isCursorMessage(message)) {
      ws.publish(docName, message)
      return
    }

    const doc = getOrCreateDoc(docName)
    const bytes = typeof message === "string" ? Buffer.from(message) : message
    const update = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    try {
      Y.applyUpdate(doc, update)
      ws.publish(docName, update)
    } catch {
      // Ignore malformed updates — keep the connection alive
    }
  },

  close(ws: any) {
    const data = ws.data as CollabWSData
    if (data.clientId) {
      presence.leave(data.docName, data.clientId)
      if (data.user) {
        const message: PresenceMessage = {
          type: "presence",
          clientId: data.clientId,
          user: data.user,
          status: "offline",
        }
        ws.publish(data.docName, JSON.stringify(message))
      }
    }
    ws.unsubscribe(data.docName)
  },
}

function isPresenceMessage(message: string): boolean {
  try {
    const parsed = JSON.parse(message) as {
      type?: unknown
      clientId?: unknown
      user?: { name?: unknown; color?: unknown }
      status?: unknown
    }
    return (
      parsed.type === "presence" &&
      typeof parsed.clientId === "string" &&
      typeof parsed.user?.name === "string" &&
      typeof parsed.user?.color === "string" &&
      (parsed.status === "online" || parsed.status === "offline")
    )
  } catch {
    return false
  }
}

function isCursorMessage(message: string): boolean {
  try {
    const parsed = JSON.parse(message) as {
      type?: unknown
      clientId?: unknown
      user?: { name?: unknown; color?: unknown }
      anchor?: unknown
      head?: unknown
    }
    return (
      parsed.type === "cursor" &&
      typeof parsed.clientId === "string" &&
      typeof parsed.user?.name === "string" &&
      typeof parsed.user?.color === "string" &&
      typeof parsed.anchor === "number" &&
      typeof parsed.head === "number"
    )
  } catch {
    return false
  }
}
