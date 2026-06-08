import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import { createScheduler } from "../../src/content/scheduler"
import { createContentService } from "../../src/content/service"
import { bootstrapTables } from "../../src/db/bootstrap"
import { createDatabase } from "../../src/db/connection"
import { generateTable } from "../../src/db/generate-table"
import { defineCollection } from "../../src/schema/collection"
import { field } from "../../src/schema/field"

const testDbPath = "test-scheduler.db"

const blogPost = defineCollection({
  name: "blog_post",
  labels: { singular: "Blog Post", plural: "Blog Posts" },
  fields: {
    title: field.text({ required: true }),
    status: field.select(["draft", "in_review", "published", "archived", "scheduled"], {
      default: "draft",
    }),
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

  test("promoteScheduled() publishes due draft and review posts with ISO publish timestamps", async () => {
    const due = "2026-05-31T05:00:00.000Z"
    const future = "2026-05-31T05:00:00.001Z"

    await service.create({ title: "Due Draft", status: "draft", publishedAt: due })
    await service.create({ title: "Due Review", status: "in_review", publishedAt: due })
    await service.create({ title: "Future Draft", status: "draft", publishedAt: future })
    await service.create({ title: "Archived Draft", status: "archived", publishedAt: due })

    const collections = new Map()
    collections.set("blog_post", { def: blogPost, table: generateTable(blogPost), service })

    const scheduler = createScheduler(collections)
    const promoted = await scheduler.promoteScheduled(new Date(due))

    expect(promoted.map((doc) => doc.title).sort()).toEqual(["Due Draft", "Due Review"])

    const all = await service.findMany()
    expect(all.find((doc) => doc.title === "Due Draft")?.status).toBe("published")
    expect(all.find((doc) => doc.title === "Due Review")?.status).toBe("published")
    expect(all.find((doc) => doc.title === "Future Draft")?.status).toBe("draft")
    expect(all.find((doc) => doc.title === "Archived Draft")?.status).toBe("archived")
  })

  test("promoteScheduled() ignores invalid publish timestamps", async () => {
    await service.create({ title: "Invalid Date", status: "draft", publishedAt: "not-a-date" })

    const collections = new Map()
    collections.set("blog_post", { def: blogPost, table: generateTable(blogPost), service })

    const scheduler = createScheduler(collections)
    const promoted = await scheduler.promoteScheduled(new Date("2026-05-31T05:00:00.000Z"))

    expect(promoted).toHaveLength(0)
    const all = await service.findMany()
    expect(all.find((doc) => doc.title === "Invalid Date")?.status).toBe("draft")
  })
})
