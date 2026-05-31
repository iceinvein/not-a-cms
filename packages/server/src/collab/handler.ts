import * as Y from "yjs"

const docs = new Map<string, Y.Doc>()

export function getOrCreateDoc(docName: string): Y.Doc {
  if (!docs.has(docName)) {
    docs.set(docName, new Y.Doc())
  }
  return docs.get(docName)!
}

export type CollabWSData = {
  docName: string
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
    const { docName } = ws.data as CollabWSData
    if (typeof message === "string" && isPresenceMessage(message)) {
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
    const { docName } = ws.data as CollabWSData
    ws.unsubscribe(docName)
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
    return parsed.type === "presence" &&
      typeof parsed.clientId === "string" &&
      typeof parsed.user?.name === "string" &&
      typeof parsed.user?.color === "string" &&
      (parsed.status === "online" || parsed.status === "offline")
  } catch {
    return false
  }
}
