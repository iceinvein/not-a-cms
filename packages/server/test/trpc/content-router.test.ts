import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { appRouter } from "../../src/trpc/router"
import { createCallerFactory } from "../../src/trpc/context"
import {
  createDatabase,
  generateTable,
  defineCollection,
  field,
  createContentService,
} from "@not-a-cms/core"
import { sql } from "drizzle-orm"
import { unlinkSync } from "node:fs"

const testDbPath = "test-trpc.db"

const page = defineCollection({
  name: "page",
  fields: {
    title: field.text({ required: true }),
    slug: field.slug({ from: "title" }),
    status: field.select(["draft", "published"], { default: "draft" }),
  },
})

describe("content tRPC router", () => {
  let db: ReturnType<typeof createDatabase>
  let caller: any

  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    db.run(sql`CREATE TABLE IF NOT EXISTS page (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT,
      status TEXT,
      created_at TEXT,
      updated_at TEXT
    )`)

    const pageTable = generateTable(page)
    const collections = new Map([
      ["page", { def: page, table: pageTable, service: createContentService(db, page, pageTable) }],
    ])

    const trpcRouter = appRouter(collections)
    const createCaller = createCallerFactory(trpcRouter)
    caller = createCaller({ db, session: null })
  })

  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("content.create creates a document", async () => {
    const doc = await caller.content.create({
      collection: "page",
      data: { title: "Test Page", slug: "test-page", status: "draft" },
    })
    expect(doc.id).toBeDefined()
    expect(doc.title).toBe("Test Page")
  })

  test("content.findById retrieves a document", async () => {
    const created = await caller.content.create({
      collection: "page",
      data: { title: "Find Me", slug: "find-me" },
    })
    const found = await caller.content.findById({
      collection: "page",
      id: created.id,
    })
    expect(found).toBeDefined()
    expect(found.title).toBe("Find Me")
  })

  test("content.findMany lists documents", async () => {
    await caller.content.create({ collection: "page", data: { title: "A", slug: "a" } })
    await caller.content.create({ collection: "page", data: { title: "B", slug: "b" } })
    const all = await caller.content.findMany({ collection: "page" })
    expect(all.length).toBe(2)
  })

  test("content.update modifies a document", async () => {
    const created = await caller.content.create({
      collection: "page",
      data: { title: "Original", slug: "original" },
    })
    const updated = await caller.content.update({
      collection: "page",
      id: created.id,
      data: { title: "Updated" },
    })
    expect(updated.title).toBe("Updated")
  })

  test("content.remove deletes a document", async () => {
    const created = await caller.content.create({
      collection: "page",
      data: { title: "Delete Me", slug: "delete-me" },
    })
    const result = await caller.content.remove({
      collection: "page",
      id: created.id,
    })
    expect(result).toBe(true)
  })

  test("content.create throws for unknown collection", async () => {
    expect(
      caller.content.create({ collection: "unknown", data: { title: "X" } }),
    ).rejects.toThrow()
  })
})
