import { test, expect, describe, afterAll, beforeAll } from "bun:test"
import { createServer } from "../src/index"
import { defineCollection, field } from "@not-a-cms/core"
import { unlinkSync } from "node:fs"

const testDbPath = "test-integration.db"

const blogPost = defineCollection({
  name: "blog_post",
  fields: {
    title: field.text({ required: true }),
    slug: field.slug({ from: "title" }),
    body: field.richText(),
    status: field.select(["draft", "published"], { default: "draft" }),
  },
})

let baseUrl: string
let serverInstance: ReturnType<typeof createServer>

describe("integration: full server", () => {
  beforeAll(() => {
    serverInstance = createServer({
      port: 0, // random available port
      database: { url: testDbPath },
      auth: {
        secret: "a".repeat(32),
        baseURL: "http://localhost",
        magicLink: { sendMagicLink: async () => {} },
      },
      collections: [blogPost],
    })
    baseUrl = `http://localhost:${serverInstance.server.port}`
  })

  afterAll(() => {
    serverInstance.server.stop()
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("health check returns ok", async () => {
    const res = await fetch(`${baseUrl}/health`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("ok")
  })

  test("REST: full CRUD lifecycle", async () => {
    // Create
    const createRes = await fetch(`${baseUrl}/api/blog_post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Integration Test Post",
        slug: "integration-test",
        body: JSON.stringify([{ type: "paragraph", children: [{ type: "text", value: "Hello" }] }]),
        status: "draft",
      }),
    })
    expect(createRes.status).toBe(201)
    const post = await createRes.json()
    expect(post.title).toBe("Integration Test Post")
    expect(post.id).toBeDefined()

    // Retrieve by ID
    const getRes = await fetch(`${baseUrl}/api/blog_post/${post.id}`)
    expect(getRes.status).toBe(200)
    const found = await getRes.json()
    expect(found.title).toBe("Integration Test Post")

    // List
    const listRes = await fetch(`${baseUrl}/api/blog_post`)
    expect(listRes.status).toBe(200)
    const list = await listRes.json()
    expect(list.data.length).toBeGreaterThanOrEqual(1)

    // Update
    const updateRes = await fetch(`${baseUrl}/api/blog_post/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Title" }),
    })
    expect(updateRes.status).toBe(200)
    const updated = await updateRes.json()
    expect(updated.title).toBe("Updated Title")

    // Delete
    const deleteRes = await fetch(`${baseUrl}/api/blog_post/${post.id}`, {
      method: "DELETE",
    })
    expect(deleteRes.status).toBe(200)
    const deleted = await deleteRes.json()
    expect(deleted.deleted).toBe(true)
  })

  test("auth endpoint responds", async () => {
    const res = await fetch(`${baseUrl}/api/auth/ok`)
    expect(res.status).toBe(200)
  })

  test("unknown route returns 404", async () => {
    const res = await fetch(`${baseUrl}/nothing`)
    expect(res.status).toBe(404)
  })
})
