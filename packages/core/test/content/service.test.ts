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
    status: field.select(["draft", "published"]),
  },
})

let db: ReturnType<typeof createDatabase>
let service: ReturnType<typeof createContentService>

describe("createContentService", () => {
  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    db.run(sql`CREATE TABLE IF NOT EXISTS page (id TEXT PRIMARY KEY, title TEXT NOT NULL, slug TEXT, body TEXT, status TEXT, created_at TEXT, updated_at TEXT)`)
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

  test("findById() retrieves by id", async () => {
    const created = await service.create({ title: "Find Me" })
    const found = await service.findById(created.id as string)
    expect(found).not.toBeNull()
    expect(found?.title).toBe("Find Me")
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

  test("update() modifies a document", async () => {
    const created = await service.create({ title: "Old Title" })
    const updated = await service.update(created.id as string, { title: "New Title" })
    expect(updated.title).toBe("New Title")
  })

  test("update() sets updated_at to a new value", async () => {
    const created = await service.create({ title: "Doc" })
    const originalUpdatedAt = created.updated_at

    // Small delay to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 5))

    const updated = await service.update(created.id as string, { title: "Doc Updated" })
    expect(updated.updated_at).not.toBe(originalUpdatedAt)
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

  test("automation dispatch fires content.published on status transition", async () => {
    const dispatched: Array<{ event: string }> = []
    const tableWithAuto = generateTable(page)
    const serviceWithAuto = createContentService(db, page, tableWithAuto, undefined, undefined, {
      dispatch: (event) => { dispatched.push({ event }) },
    })
    const doc = await serviceWithAuto.create({ title: "Draft", status: "draft" })
    dispatched.length = 0
    await serviceWithAuto.update(doc.id as string, { status: "published" })
    expect(dispatched.some(d => d.event === "content.published")).toBe(true)
  })
})
