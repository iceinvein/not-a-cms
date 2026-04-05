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
    const doc = getOrCreateDoc(docName)
    const update = new Uint8Array(message as ArrayBuffer)
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
