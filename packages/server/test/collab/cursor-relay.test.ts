import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import { defineCollection, field } from "@not-a-cms/core"
import { createServer } from "../../src/index"

const testDbPath = "test-collab-cursor.db"
const page = defineCollection({ name: "page", fields: { title: field.text() } })

describe("collab WebSocket cursor relay", () => {
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

  test("broadcasts cursor messages between clients for the same document", async () => {
    const docName = `cursor-${crypto.randomUUID()}`
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

    const cursor = {
      type: "cursor",
      clientId: "client-a",
      user: { name: "Editor A", color: "#c9956b" },
      anchor: 5,
      head: 5,
    }
    wsA.send(JSON.stringify(cursor))

    expect(JSON.parse(await received)).toEqual(cursor)
    wsA.close()
    wsB.close()
  })
})
