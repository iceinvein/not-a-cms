import { test, expect, describe, beforeAll, afterAll } from "bun:test"
import { createServer } from "../../src/index"
import { defineCollection, field } from "@not-a-cms/core"
import { unlinkSync, rmSync, existsSync } from "node:fs"

const testDbPath = "test-media.db"
const uploadsDir = "./test-uploads"

const page = defineCollection({ name: "page", fields: { title: field.text() } })

describe("media API", () => {
  let baseUrl: string
  let server: ReturnType<typeof createServer>

  beforeAll(() => {
    server = createServer({
      port: 0,
      database: { url: testDbPath },
      auth: { secret: "a".repeat(32), baseURL: "http://localhost", magicLink: { sendMagicLink: async () => {} } },
      collections: [page],
      storage: { provider: "local", path: uploadsDir },
    })
    baseUrl = `http://localhost:${server.server.port}`
  })

  afterAll(() => {
    server.server.stop()
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
    if (existsSync(uploadsDir)) rmSync(uploadsDir, { recursive: true })
  })

  test("POST /api/media/upload stores a file", async () => {
    const formData = new FormData()
    formData.append("file", new Blob(["hello world"], { type: "text/plain" }), "test.txt")
    const res = await fetch(`${baseUrl}/api/media/upload`, { method: "POST", body: formData })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.id).toBeDefined()
    expect(data.filename).toBe("test.txt")
  })

  test("GET /api/media lists uploaded files", async () => {
    const res = await fetch(`${baseUrl}/api/media`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.data.length).toBeGreaterThanOrEqual(1)
  })

  test("DELETE /api/media/:id removes a file", async () => {
    const listRes = await fetch(`${baseUrl}/api/media`)
    const list = await listRes.json()
    const id = list.data[0].id
    const res = await fetch(`${baseUrl}/api/media/${id}`, { method: "DELETE" })
    expect(res.status).toBe(200)
    expect((await res.json()).deleted).toBe(true)
  })
})
