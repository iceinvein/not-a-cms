import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import { defineCollection, field } from "@not-a-cms/core"
import { createServer } from "../../src/index"

const testDbPath = "test-graphql.db"

const author = defineCollection({
  name: "author",
  labels: { singular: "Author", plural: "Authors" },
  fields: {
    name: field.text({ required: true }),
    secret: field.text({ access: { read: ["admin"] } }),
  },
})

const media = defineCollection({
  name: "media",
  labels: { singular: "Media", plural: "Media" },
  fields: {
    title: field.text({ required: true }),
    url: field.text({ required: true }),
    alt: field.text(),
    secret: field.text({ access: { read: ["admin"] } }),
  },
})

const blogPost = defineCollection({
  name: "blog_post",
  labels: { singular: "Blog Post", plural: "Blog Posts" },
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    slug: field.slug({ from: "title" }),
    body: field.richText(),
    tags: field.array(field.text()),
    seo: field.group({
      metaTitle: field.text(),
      featured: field.boolean(),
    }),
    author: field.relation("author"),
    coverImage: field.media({ accept: ["image/*"] }),
    lockedPage: field.relation("locked_page"),
    status: field.select(["draft", "published"], { default: "draft" }),
    views: field.number(),
    featured: field.boolean(),
    secret: field.text({ access: { read: ["admin"] } }),
  },
})

const lockedPage = defineCollection({
  name: "locked_page",
  access: { read: ["admin"] },
  fields: {
    title: field.text({ required: true }),
    slug: field.slug({ from: "title" }),
  },
})

let baseUrl: string
let server: ReturnType<typeof createServer>

describe("GraphQL endpoint", () => {
  beforeAll(async () => {
    server = createServer({
      port: 0,
      database: { url: testDbPath },
      auth: {
        secret: "a".repeat(32),
        baseURL: "http://localhost",
        magicLink: { sendMagicLink: async () => {} },
      },
      collections: [author, media, blogPost, lockedPage],
    })
    baseUrl = `http://localhost:${server.server.port}`
    const authorService = server.collections.get("author")!.service
    const createdAuthor = await authorService.create({ name: "Ada", secret: "admin-only" })
    const mediaService = server.collections.get("media")!.service
    const createdImage = await mediaService.create({
      title: "Hero",
      url: "https://cdn.example.com/hero.jpg",
      alt: "Hero image",
      secret: "admin-only",
    })
    const createdLockedPage = await server.collections
      .get("locked_page")!
      .service.create({ title: "Locked", slug: "locked" })
    const service = server.collections.get("blog_post")!.service
    await service.create({
      title: "First Post",
      slug: "first-post",
      body: [{ type: "paragraph", children: [{ text: "Typed body" }] }],
      tags: ["one", "two"],
      seo: { metaTitle: "Typed SEO", featured: true },
      author: createdAuthor.id,
      coverImage: createdImage.id,
      lockedPage: createdLockedPage.id,
      status: "published",
      secret: "admin-only",
    })
    await service.create({ title: "Draft Post", slug: "draft-post", status: "draft" })
  })

  afterAll(() => {
    server.server.stop()
    try {
      unlinkSync(testDbPath)
    } catch {}
    try {
      unlinkSync(testDbPath + "-wal")
    } catch {}
    try {
      unlinkSync(testDbPath + "-shm")
    } catch {}
  })

  test("POST /graphql executes a list query", async () => {
    const res = await fetch(`${baseUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: `{ blogPosts { id title slug status } }` }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.data.blogPosts).toHaveLength(2)
    expect(data.data.blogPosts[0].title).toBeDefined()
  })

  test("supports where argument as JSON string", async () => {
    const where = JSON.stringify({ status: "published" })
    const res = await fetch(`${baseUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: `{ blogPosts(where: ${JSON.stringify(where)}) { title } }` }),
    })
    const data = await res.json()
    expect(data.data.blogPosts).toHaveLength(1)
    expect(data.data.blogPosts[0].title).toBe("First Post")
  })

  test("supports limit argument", async () => {
    const res = await fetch(`${baseUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: `{ blogPosts(limit: 1) { title } }` }),
    })
    const data = await res.json()
    expect(data.data.blogPosts).toHaveLength(1)
  })

  test("supports list metadata fields", async () => {
    const res = await fetch(`${baseUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `{ blogPostsList(limit: 1, offset: 1) { total limit offset data { title } } }`,
      }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.errors).toBeUndefined()
    expect(data.data.blogPostsList.total).toBe(2)
    expect(data.data.blogPostsList.limit).toBe(1)
    expect(data.data.blogPostsList.offset).toBe(1)
    expect(data.data.blogPostsList.data).toHaveLength(1)
  })

  test("supports single item query by id", async () => {
    const listRes = await fetch(`${baseUrl}/api/blog_post`)
    const listData = await listRes.json()
    const id = listData.data[0].id
    const res = await fetch(`${baseUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: `{ blogPost(id: "${id}") { id title } }` }),
    })
    const data = await res.json()
    expect(data.data.blogPost.id).toBe(id)
  })

  test("filters unreadable fields for anonymous callers", async () => {
    const where = JSON.stringify({ slug: "first-post" })
    const res = await fetch(`${baseUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `{ blogPosts(where: ${JSON.stringify(where)}) { title secret } }`,
      }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.errors).toBeUndefined()
    expect(data.data.blogPosts).toHaveLength(1)
    expect(data.data.blogPosts[0].title).toBe("First Post")
    expect(data.data.blogPosts[0].secret).toBeNull()
  })

  test("returns JSON values for structured fields and public IDs for references", async () => {
    const where = JSON.stringify({ slug: "first-post" })
    const res = await fetch(`${baseUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `{ blogPosts(where: ${JSON.stringify(where)}) { body tags seo author coverImage } }`,
      }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.errors).toBeUndefined()
    const post = data.data.blogPosts[0]
    expect(post.body).toEqual([{ type: "paragraph", children: [{ text: "Typed body" }] }])
    expect(post.tags).toEqual(["one", "two"])
    expect(post.seo).toEqual({ metaTitle: "Typed SEO", featured: true })
    expect(post.author).toBeTruthy()
    expect(post.coverImage).toBeTruthy()
  })

  test("adds nested GraphQL object fields for relation references", async () => {
    const where = JSON.stringify({ slug: "first-post" })
    const res = await fetch(`${baseUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `{ blogPosts(where: ${JSON.stringify(where)}) { author authorDocument { name secret } } }`,
      }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.errors).toBeUndefined()
    expect(data.data.blogPosts[0].author).toBeTruthy()
    expect(data.data.blogPosts[0].authorDocument.name).toBe("Ada")
    expect(data.data.blogPosts[0].authorDocument.secret).toBeNull()
  })

  test("adds nested GraphQL object fields for media references", async () => {
    const where = JSON.stringify({ slug: "first-post" })
    const res = await fetch(`${baseUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `{ blogPosts(where: ${JSON.stringify(where)}) { coverImage coverImageDocument { title url alt secret } } }`,
      }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.errors).toBeUndefined()
    expect(data.data.blogPosts[0].coverImage).toBeTruthy()
    expect(data.data.blogPosts[0].coverImageDocument).toMatchObject({
      title: "Hero",
      url: "https://cdn.example.com/hero.jpg",
      alt: "Hero image",
      secret: null,
    })
  })

  test("returns null for nested documents when target collection is not readable", async () => {
    const where = JSON.stringify({ slug: "first-post" })
    const res = await fetch(`${baseUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `{ blogPosts(where: ${JSON.stringify(where)}) { lockedPage lockedPageDocument { title } } }`,
      }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.errors).toBeUndefined()
    expect(data.data.blogPosts[0].lockedPage).toBeTruthy()
    expect(data.data.blogPosts[0].lockedPageDocument).toBeNull()
  })

  test("returns a GraphQL error for invalid where JSON", async () => {
    const res = await fetch(`${baseUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: `{ blogPosts(where: "{") { title } }` }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.errors?.[0]?.message).toContain("Invalid where JSON")
    expect(data.data.blogPosts).toBeNull()
  })

  test("returns empty restricted collections for anonymous callers", async () => {
    const res = await fetch(`${baseUrl}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: `{ lockedPages { title } }` }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.errors).toBeUndefined()
    expect(data.data.lockedPages).toEqual([])
  })
})
