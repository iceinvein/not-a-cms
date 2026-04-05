import { test, expect, describe, beforeAll, afterAll } from "bun:test"
import { createServer } from "../../src/index"
import { defineCollection, field } from "@not-a-cms/core"
import { unlinkSync } from "node:fs"

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
})
