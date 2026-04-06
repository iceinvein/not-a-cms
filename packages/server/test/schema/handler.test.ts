import { test, expect, describe, beforeAll, afterAll } from "bun:test"
import { createServer } from "../../src/index"
import { defineCollection, field } from "@not-a-cms/core"
import { unlinkSync } from "node:fs"

const testDbPath = "test-schema-api.db"

const blogPost = defineCollection({
  name: "blog_post",
  labels: { singular: "Blog Post", plural: "Blog Posts" },
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    slug: field.slug({ from: "title" }),
    body: field.richText(),
    status: field.select(["draft", "published"], { default: "draft" }),
  },
})

const page = defineCollection({
  name: "page",
  fields: {
    title: field.text({ required: true }),
    body: field.richText(),
  },
})

describe("schema API", () => {
  let baseUrl: string
  let server: ReturnType<typeof createServer>

  beforeAll(() => {
    server = createServer({
      port: 0,
      database: { url: testDbPath },
      auth: { secret: "a".repeat(32), baseURL: "http://localhost", magicLink: { sendMagicLink: async () => {} } },
      collections: [blogPost, page],
    })
    baseUrl = `http://localhost:${server.server.port}`
  })

  afterAll(() => {
    server.server.stop()
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("GET /api/_schema returns all collections", async () => {
    const res = await fetch(`${baseUrl}/api/_schema`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.collections).toHaveLength(2)
  })

  test("each collection has name, labels, and fields", async () => {
    const res = await fetch(`${baseUrl}/api/_schema`)
    const data = await res.json()
    const blog = data.collections.find((c: any) => c.name === "blog_post")
    expect(blog).toBeDefined()
    expect(blog.labels.singular).toBe("Blog Post")
    expect(blog.fields.title.type).toBe("text")
    expect(blog.fields.title.required).toBe(true)
  })

  test("GET /api/_schema/:collection returns single collection", async () => {
    const res = await fetch(`${baseUrl}/api/_schema/blog_post`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe("blog_post")
    expect(data.fields.body.type).toBe("richText")
  })

  test("GET /api/_schema/:unknown returns 404", async () => {
    const res = await fetch(`${baseUrl}/api/_schema/nonexistent`)
    expect(res.status).toBe(404)
  })
})
