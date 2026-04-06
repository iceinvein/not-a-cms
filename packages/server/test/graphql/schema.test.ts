import { test, expect, describe, beforeAll, afterAll } from "bun:test"
import { unlinkSync } from "node:fs"
import { createServer } from "../../src/index"
import { defineCollection, field } from "@not-a-cms/core"

const testDbPath = "test-graphql.db"

const blogPost = defineCollection({
  name: "blog_post",
  labels: { singular: "Blog Post", plural: "Blog Posts" },
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    slug: field.slug({ from: "title" }),
    body: field.richText(),
    status: field.select(["draft", "published"], { default: "draft" }),
    views: field.number(),
    featured: field.boolean(),
  },
})

let baseUrl: string
let server: ReturnType<typeof createServer>

describe("GraphQL endpoint", () => {
  beforeAll(async () => {
    server = createServer({
      port: 0,
      database: { url: testDbPath },
      auth: { secret: "a".repeat(32), baseURL: "http://localhost", magicLink: { sendMagicLink: async () => {} } },
      collections: [blogPost],
    })
    baseUrl = `http://localhost:${server.server.port}`
    await fetch(`${baseUrl}/api/blog_post`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "First Post", slug: "first-post", status: "published" }) })
    await fetch(`${baseUrl}/api/blog_post`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Draft Post", slug: "draft-post", status: "draft" }) })
  })

  afterAll(() => {
    server.server.stop()
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("POST /graphql executes a list query", async () => {
    const res = await fetch(`${baseUrl}/graphql`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: `{ blogPosts { id title slug status } }` }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.data.blogPosts).toHaveLength(2)
    expect(data.data.blogPosts[0].title).toBeDefined()
  })

  test("supports where argument as JSON string", async () => {
    const where = JSON.stringify({ status: "published" })
    const res = await fetch(`${baseUrl}/graphql`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: `{ blogPosts(where: ${JSON.stringify(where)}) { title } }` }) })
    const data = await res.json()
    expect(data.data.blogPosts).toHaveLength(1)
    expect(data.data.blogPosts[0].title).toBe("First Post")
  })

  test("supports limit argument", async () => {
    const res = await fetch(`${baseUrl}/graphql`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: `{ blogPosts(limit: 1) { title } }` }) })
    const data = await res.json()
    expect(data.data.blogPosts).toHaveLength(1)
  })

  test("supports single item query by id", async () => {
    const listRes = await fetch(`${baseUrl}/api/blog_post`)
    const listData = await listRes.json()
    const id = listData.data[0].id
    const res = await fetch(`${baseUrl}/graphql`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: `{ blogPost(id: "${id}") { id title } }` }) })
    const data = await res.json()
    expect(data.data.blogPost.id).toBe(id)
  })
})
