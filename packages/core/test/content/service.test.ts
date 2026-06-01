import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { unlinkSync } from "node:fs"
import { createDatabase } from "../../src/db/connection"
import { defineCollection } from "../../src/schema/collection"
import { field } from "../../src/schema/field"
import { generateTable } from "../../src/db/generate-table"
import { createContentService } from "../../src/content/service"
import { sql } from "drizzle-orm"

const testDbPath = "test-content-service.db"

const page = defineCollection({
  name: "page",
  fields: {
    title: field.text({ required: true }),
    slug: field.slug({ from: "title" }),
    body: field.richText(),
    status: field.select(["draft", "published"], { default: "draft" }),
  },
})

const article = defineCollection({
  name: "article",
  fields: {
    title: field.text({ required: true }),
    seo: field.group({
      metaTitle: field.text({ required: true }),
      metaDescription: field.text(),
    }),
  },
})

const metric = defineCollection({
  name: "metric",
  fields: {
    title: field.text({ required: true }),
    featured: field.boolean({ default: false }),
    views: field.number({ default: 0 }),
    status: field.select(["draft", "published"], { default: "draft" }),
    publishedAt: field.datetime(),
  },
})

const product = defineCollection({
  name: "product",
  fields: {
    title: field.text({ required: true }),
    body: field.richText(),
    tags: field.array(field.text()),
    seo: field.group({
      metaTitle: field.text(),
      featured: field.boolean(),
    }),
    author: field.relation("author"),
    coverImage: field.media({ accept: ["image/*"] }),
  },
})

let db: ReturnType<typeof createDatabase>
let service: ReturnType<typeof createContentService>

describe("createContentService", () => {
  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    db.run(sql`CREATE TABLE IF NOT EXISTS page (id TEXT PRIMARY KEY, title TEXT NOT NULL, slug TEXT, body TEXT, status TEXT, created_at TEXT, updated_at TEXT)`)
    db.run(sql`CREATE TABLE IF NOT EXISTS article (id TEXT PRIMARY KEY, title TEXT NOT NULL, seo TEXT, created_at TEXT, updated_at TEXT)`)
    db.run(sql`CREATE TABLE IF NOT EXISTS metric (id TEXT PRIMARY KEY, title TEXT NOT NULL, featured INTEGER, views INTEGER, status TEXT, published_at TEXT, created_at TEXT, updated_at TEXT)`)
    db.run(sql`CREATE TABLE IF NOT EXISTS product (id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT, tags TEXT, seo TEXT, author_id TEXT, cover_image_id TEXT, created_at TEXT, updated_at TEXT)`)
    const table = generateTable(page)
    service = createContentService(db, page, table)
  })

  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("create() inserts and returns doc with id, title, created_at", async () => {
    const doc = await service.create({ title: "Hello World" })
    expect(doc.id).toBeDefined()
    expect(doc.title).toBe("Hello World")
    expect(doc.created_at).toBeDefined()
  })

  test("create() applies schema defaults before insert", async () => {
    const metricService = createContentService(db, metric, generateTable(metric))
    const doc = await metricService.create({ title: "Defaults" })

    expect(doc.featured).toBe(false)
    expect(doc.views).toBe(0)
    expect(doc.status).toBe("draft")
  })

  test("create() rejects missing required fields before insert", async () => {
    try {
      await service.create({ slug: "missing-title" })
      throw new Error("Expected create to fail")
    } catch (err) {
      expect((err as Error).message).toBe("Validation failed")
      expect((err as { issues?: Array<{ path: string; message: string }> }).issues).toEqual([
        { path: "title", message: "Required field is missing" },
      ])
    }
  })

  test("create() rejects missing required nested group fields", async () => {
    const articleService = createContentService(db, article, generateTable(article))

    try {
      await articleService.create({ title: "Nested", seo: {} })
      throw new Error("Expected create to fail")
    } catch (err) {
      expect((err as Error).message).toBe("Validation failed")
      expect((err as { issues?: Array<{ path: string; message: string }> }).issues).toEqual([
        { path: "seo.metaTitle", message: "Required field is missing" },
      ])
    }
  })

  test("findById() retrieves by id", async () => {
    const created = await service.create({ title: "Find Me" })
    const found = await service.findById(created.id as string)
    expect(found).not.toBeNull()
    expect(found?.title).toBe("Find Me")
  })

  test("create() and findById() round-trip typed field values using public field names", async () => {
    const productService = createContentService(db, product, generateTable(product))
    const richText = [{ type: "paragraph", children: [{ text: "Portable body" }] }]
    const created = await productService.create({
      title: "Typed Product",
      body: richText,
      tags: ["cms", "typed"],
      seo: { metaTitle: "Typed SEO", featured: true },
      author: "author-1",
      coverImage: "media-1",
    })

    expect(created.body).toEqual(richText)
    expect(created.tags).toEqual(["cms", "typed"])
    expect(created.seo).toEqual({ metaTitle: "Typed SEO", featured: true })
    expect(created.author).toBe("author-1")
    expect(created.coverImage).toBe("media-1")
    expect(created).not.toHaveProperty("author_id")
    expect(created).not.toHaveProperty("cover_image_id")

    const found = await productService.findById(created.id as string)
    expect(found?.body).toEqual(richText)
    expect(found?.tags).toEqual(["cms", "typed"])
    expect(found?.seo).toEqual({ metaTitle: "Typed SEO", featured: true })
    expect(found?.author).toBe("author-1")
    expect(found?.coverImage).toBe("media-1")
  })

  test("findMany() maps public where fields to storage columns", async () => {
    const productService = createContentService(db, product, generateTable(product))
    await productService.create({ title: "One", author: "author-1", coverImage: "media-1" })
    await productService.create({ title: "Two", author: "author-2", coverImage: "media-2" })

    const docs = await productService.findMany({ where: { author: "author-2", coverImage: "media-2" } })

    expect(docs).toHaveLength(1)
    expect(docs[0].title).toBe("Two")
    expect(docs[0].author).toBe("author-2")
    expect(docs[0].coverImage).toBe("media-2")
  })

  test("findById() returns null for non-existent", async () => {
    const found = await service.findById("non-existent-id")
    expect(found).toBeNull()
  })

  test("findMany() returns all documents", async () => {
    await service.create({ title: "Doc 1" })
    await service.create({ title: "Doc 2" })
    const docs = await service.findMany()
    expect(docs.length).toBe(2)
  })

  test("findMany() supports limit and offset", async () => {
    await service.create({ title: "Doc 1" })
    await service.create({ title: "Doc 2" })
    await service.create({ title: "Doc 3" })
    const docs = await service.findMany({ limit: 2, offset: 1 })
    expect(docs.length).toBe(2)
  })

  test("findMany() supports where filter", async () => {
    await service.create({ title: "Draft", status: "draft" })
    await service.create({ title: "Published", status: "published" })
    const docs = await service.findMany({ where: { status: "published" } })
    expect(docs.length).toBe(1)
    expect(docs[0].title).toBe("Published")
  })

  test("findMany() supports sorting by public field name", async () => {
    const metricService = createContentService(db, metric, generateTable(metric))
    await metricService.create({ title: "Low", views: 1 })
    await metricService.create({ title: "High", views: 10 })
    await metricService.create({ title: "Middle", views: 5 })

    const docs = await metricService.findMany({ sort: "views", order: "desc" })

    expect(docs.map((doc) => doc.title)).toEqual(["High", "Middle", "Low"])
  })

  test("findMany() supports safe where operators", async () => {
    const metricService = createContentService(db, metric, generateTable(metric))
    await metricService.create({ title: "Alpha launch", status: "draft", views: 2 })
    await metricService.create({ title: "Beta launch", status: "published", views: 8 })
    await metricService.create({ title: "Gamma note", status: "published", views: 13 })

    const docs = await metricService.findMany({
      where: {
        title: { contains: "launch" },
        status: { in: ["draft", "published"] },
        views: { gt: 5, lt: 10 },
      },
    })

    expect(docs).toHaveLength(1)
    expect(docs[0].title).toBe("Beta launch")
  })

  test("count() returns total matching safe filters without limit", async () => {
    const metricService = createContentService(db, metric, generateTable(metric))
    await metricService.create({ title: "A", status: "draft", views: 1 })
    await metricService.create({ title: "B", status: "published", views: 5 })
    await metricService.create({ title: "C", status: "published", views: 9 })

    const docs = await metricService.findMany({ where: { status: "published" }, limit: 1 })
    const total = await metricService.count({ where: { status: "published" } })

    expect(docs).toHaveLength(1)
    expect(total).toBe(2)
  })

  test("findMany() rejects unknown fields and operators", async () => {
    const metricService = createContentService(db, metric, generateTable(metric))

    await expect(metricService.findMany({ where: { unknown: "x" } })).rejects.toThrow("Unknown field")
    await expect(metricService.findMany({ where: { title: { startsWith: "A" } } })).rejects.toThrow("Unsupported operator")
    await expect(metricService.findMany({ sort: "unknown" })).rejects.toThrow("Unknown field")
  })

  test("update() modifies a document", async () => {
    const created = await service.create({ title: "Old Title" })
    const updated = await service.update(created.id as string, { title: "New Title" })
    expect(updated.title).toBe("New Title")
  })

  test("update() round-trips typed field values", async () => {
    const productService = createContentService(db, product, generateTable(product))
    const created = await productService.create({ title: "Before", tags: ["old"], seo: { metaTitle: "Old" } })

    const updated = await productService.update(created.id as string, {
      tags: ["new"],
      seo: { metaTitle: "New", featured: false },
      author: "author-3",
      coverImage: "media-3",
    })

    expect(updated.tags).toEqual(["new"])
    expect(updated.seo).toEqual({ metaTitle: "New", featured: false })
    expect(updated.author).toBe("author-3")
    expect(updated.coverImage).toBe("media-3")
  })

  test("update() rejects clearing required fields", async () => {
    const created = await service.create({ title: "Cannot Clear" })

    try {
      await service.update(created.id as string, { title: "" })
      throw new Error("Expected update to fail")
    } catch (err) {
      expect((err as Error).message).toBe("Validation failed")
      expect((err as { issues?: Array<{ path: string; message: string }> }).issues).toEqual([
        { path: "title", message: "Required field is missing" },
      ])
    }
  })

  test("update() sets updated_at to a new value", async () => {
    const created = await service.create({ title: "Doc" })
    const originalUpdatedAt = created.updated_at

    // Small delay to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 5))

    const updated = await service.update(created.id as string, { title: "Doc Updated" })
    expect(updated.updated_at).not.toBe(originalUpdatedAt)
  })

  test("bulkUpdate() updates multiple documents and reports missing ids", async () => {
    const first = await service.create({ title: "First" })
    const second = await service.create({ title: "Second" })

    const result = await service.bulkUpdate([first.id as string, "missing-id", second.id as string], { title: "Bulk Updated" })

    expect(result.updated.map((doc) => doc.id)).toEqual([first.id, second.id])
    expect(result.updated.map((doc) => doc.title)).toEqual(["Bulk Updated", "Bulk Updated"])
    expect(result.notFound).toEqual(["missing-id"])
  })

  test("remove() deletes and returns true", async () => {
    const created = await service.create({ title: "To Delete" })
    const result = await service.remove(created.id as string)
    expect(result).toBe(true)
    const found = await service.findById(created.id as string)
    expect(found).toBeNull()
  })

  test("remove() returns false for non-existent", async () => {
    const result = await service.remove("non-existent-id")
    expect(result).toBe(false)
  })

  test("bulkDelete() deletes multiple documents and reports missing ids", async () => {
    const first = await service.create({ title: "First Delete" })
    const second = await service.create({ title: "Second Delete" })

    const result = await service.bulkDelete([first.id as string, "missing-id", second.id as string])

    expect(result.deleted).toEqual([first.id, second.id])
    expect(result.notFound).toEqual(["missing-id"])
    expect(await service.findById(first.id as string)).toBeNull()
    expect(await service.findById(second.id as string)).toBeNull()
  })

  test("automation dispatch fires on create", async () => {
    const dispatched: Array<{ event: string; collection: string }> = []
    const tableWithAuto = generateTable(page)
    const serviceWithAuto = createContentService(db, page, tableWithAuto, undefined, undefined, {
      dispatch: (event, collection) => { dispatched.push({ event, collection }) },
    })
    await serviceWithAuto.create({ title: "Auto Test" })
    expect(dispatched).toHaveLength(1)
    expect(dispatched[0].event).toBe("content.created")
  })

  test("automation dispatch fires content.published on workflow publish", async () => {
    const dispatched: Array<{ event: string }> = []
    const tableWithAuto = generateTable(page)
    const serviceWithAuto = createContentService(db, page, tableWithAuto, undefined, undefined, {
      dispatch: (event) => { dispatched.push({ event }) },
    })
    const doc = await serviceWithAuto.create({ title: "Draft", status: "draft" })
    dispatched.length = 0
    await serviceWithAuto.transitionStatus(doc.id as string, "publish", "editor")
    expect(dispatched.some(d => d.event === "content.published")).toBe(true)
  })

  test("embedding hooks receive extracted text on create and update, and remove on delete", async () => {
    const indexed: Array<{ collection: string; docId: string; title: string; bodyText: string }> = []
    const removed: Array<{ collection: string; docId: string }> = []
    const serviceWithEmbeddings = createContentService(
      db,
      page,
      generateTable(page),
      undefined,
      undefined,
      undefined,
      {
        index: (collection, docId, title, bodyText) => {
          indexed.push({ collection, docId, title, bodyText })
        },
        remove: (collection, docId) => {
          removed.push({ collection, docId })
        },
      },
    )

    const created = await serviceWithEmbeddings.create({
      title: "Embedding Title",
      body: [{ type: "paragraph", children: [{ text: "Semantic body" }] }],
    })
    await serviceWithEmbeddings.update(created.id as string, {
      body: [{ type: "paragraph", children: [{ text: "Updated semantic body" }] }],
    })
    await serviceWithEmbeddings.remove(created.id as string)

    expect(indexed).toHaveLength(2)
    expect(indexed[0]).toMatchObject({
      collection: "page",
      docId: created.id,
      title: "Embedding Title",
      bodyText: "Semantic body",
    })
    expect(indexed[1]).toMatchObject({
      collection: "page",
      docId: created.id,
      title: "Embedding Title",
      bodyText: "Updated semantic body",
    })
    expect(removed).toEqual([{ collection: "page", docId: created.id }])
  })
})
