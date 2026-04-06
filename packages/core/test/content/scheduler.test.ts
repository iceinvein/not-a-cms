import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { unlinkSync } from "node:fs"
import { createDatabase } from "../../src/db/connection"
import { bootstrapTables } from "../../src/db/bootstrap"
import { defineCollection } from "../../src/schema/collection"
import { field } from "../../src/schema/field"
import { generateTable } from "../../src/db/generate-table"
import { createContentService } from "../../src/content/service"
import { createScheduler } from "../../src/content/scheduler"

const testDbPath = "test-scheduler.db"

const blogPost = defineCollection({
  name: "blog_post",
  labels: { singular: "Blog Post", plural: "Blog Posts" },
  fields: {
    title: field.text({ required: true }),
    status: field.select(["draft", "published", "scheduled"], { default: "draft" }),
    publishedAt: field.datetime(),
  },
})

let db: ReturnType<typeof createDatabase>
let service: ReturnType<typeof createContentService>

describe("createScheduler", () => {
  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [blogPost])
    const table = generateTable(blogPost)
    service = createContentService(db, blogPost, table)
  })

  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("promoteScheduled() publishes posts with past publishedAt", async () => {
    const past = new Date(Date.now() - 60000).toISOString()
    await service.create({ title: "Scheduled Post", status: "scheduled", published_at: past })
    await service.create({ title: "Draft Post", status: "draft" })

    const collections = new Map()
    collections.set("blog_post", { def: blogPost, table: generateTable(blogPost), service })

    const scheduler = createScheduler(collections)
    const promoted = await scheduler.promoteScheduled()

    expect(promoted).toHaveLength(1)
    expect(promoted[0].title).toBe("Scheduled Post")

    const all = await service.findMany()
    const scheduled = all.find((p) => p.title === "Scheduled Post")
    expect(scheduled?.status).toBe("published")
  })

  test("promoteScheduled() ignores future publishedAt", async () => {
    const future = new Date(Date.now() + 3600000).toISOString()
    await service.create({ title: "Future Post", status: "scheduled", published_at: future })

    const collections = new Map()
    collections.set("blog_post", { def: blogPost, table: generateTable(blogPost), service })

    const scheduler = createScheduler(collections)
    const promoted = await scheduler.promoteScheduled()
    expect(promoted).toHaveLength(0)
  })
})
