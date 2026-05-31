import { test, expect, describe, beforeAll, afterAll } from "bun:test"
import { createServer } from "../../src/index"
import { defineCollection, field } from "@not-a-cms/core"
import { unlinkSync } from "node:fs"
import * as Y from "yjs"

const testDbPath = "test-collab.db"
const page = defineCollection({ name: "page", fields: { title: field.text() } })

describe("collab WebSocket", () => {
  let wsUrl: string
  let server: ReturnType<typeof createServer>

  beforeAll(() => {
    server = createServer({
      port: 0,
      database: { url: testDbPath },
      auth: { secret: "a".repeat(32), baseURL: "http://localhost", magicLink: { sendMagicLink: async () => {} } },
      collections: [page],
      collaboration: { requireAuth: false },
    })
    wsUrl = `ws://localhost:${server.server.port}`
  })

  afterAll(() => {
    server.server.stop()
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("WebSocket connects to /collab", async () => {
    const ws = new WebSocket(`${wsUrl}/collab?doc=test-doc`)
    const connected = await new Promise<boolean>((resolve) => {
      ws.onopen = () => resolve(true)
      ws.onerror = () => resolve(false)
      setTimeout(() => resolve(false), 3000)
    })
    expect(connected).toBe(true)
    ws.close()
  })

  test("WebSocket stays open after sending data", async () => {
    const ws = new WebSocket(`${wsUrl}/collab?doc=test-doc-2`)
    await new Promise<void>((resolve) => { ws.onopen = () => resolve() })
    ws.send(new Uint8Array([1, 2, 3, 4]))
    await Bun.sleep(100)
    expect(ws.readyState).toBe(WebSocket.OPEN)
    ws.close()
  })

  test("broadcasts raw Yjs updates between clients for the same document", async () => {
    const docName = `sync-${crypto.randomUUID()}`
    const wsA = new WebSocket(`${wsUrl}/collab?doc=${encodeURIComponent(docName)}`)
    const wsB = new WebSocket(`${wsUrl}/collab?doc=${encodeURIComponent(docName)}`)
    wsA.binaryType = "arraybuffer"
    wsB.binaryType = "arraybuffer"

    await Promise.all([
      new Promise<void>((resolve) => { wsA.onopen = () => resolve() }),
      new Promise<void>((resolve) => { wsB.onopen = () => resolve() }),
    ])

    const target = new Y.Doc()
    const synced = new Promise<void>((resolve) => {
      wsB.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          Y.applyUpdate(target, new Uint8Array(event.data))
          if (target.getText("default").toString() === "hello") resolve()
        }
      }
    })

    const source = new Y.Doc()
    source.getText("default").insert(0, "hello")
    wsA.send(Y.encodeStateAsUpdate(source))

    await synced

    expect(target.getText("default").toString()).toBe("hello")
    wsA.close()
    wsB.close()
  })

  test("broadcasts JSON presence messages without treating them as Yjs updates", async () => {
    const docName = `presence-${crypto.randomUUID()}`
    const wsA = new WebSocket(`${wsUrl}/collab?doc=${encodeURIComponent(docName)}`)
    const wsB = new WebSocket(`${wsUrl}/collab?doc=${encodeURIComponent(docName)}`)

    await Promise.all([
      new Promise<void>((resolve) => { wsA.onopen = () => resolve() }),
      new Promise<void>((resolve) => { wsB.onopen = () => resolve() }),
    ])

    const received = new Promise<string>((resolve) => {
      wsB.onmessage = (event) => {
        if (typeof event.data === "string") resolve(event.data)
      }
    })

    wsA.send(JSON.stringify({
      type: "presence",
      clientId: "client-a",
      user: { name: "Editor A", color: "#c9956b" },
      status: "online",
    }))

    expect(JSON.parse(await received)).toEqual({
      type: "presence",
      clientId: "client-a",
      user: { name: "Editor A", color: "#c9956b" },
      status: "online",
    })
    wsA.close()
    wsB.close()
  })
})

describe("collab WebSocket auth", () => {
  const authDbPath = "test-collab-auth.db"
  let wsUrl: string
  let server: ReturnType<typeof createServer>

  beforeAll(() => {
    server = createServer({
      port: 0,
      database: { url: authDbPath },
      auth: { secret: "a".repeat(32), baseURL: "http://localhost", magicLink: { sendMagicLink: async () => {} } },
      collections: [page],
    })
    wsUrl = `ws://localhost:${server.server.port}`
  })

  afterAll(() => {
    server.server.stop()
    try { unlinkSync(authDbPath) } catch {}
    try { unlinkSync(authDbPath + "-wal") } catch {}
    try { unlinkSync(authDbPath + "-shm") } catch {}
  })

  test("rejects anonymous websocket upgrades by default", async () => {
    const ws = new WebSocket(`${wsUrl}/collab?doc=test-doc`)
    const connected = await new Promise<boolean>((resolve) => {
      ws.onopen = () => resolve(true)
      ws.onerror = () => resolve(false)
      ws.onclose = () => resolve(false)
      setTimeout(() => resolve(false), 1000)
    })

    expect(connected).toBe(false)
  })
})
