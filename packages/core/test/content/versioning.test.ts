import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { unlinkSync } from "node:fs"
import { createDatabase } from "../../src/db/connection"
import { bootstrapTables } from "../../src/db/bootstrap"
import { defineCollection } from "../../src/schema/collection"
import { field } from "../../src/schema/field"
import { generateTable } from "../../src/db/generate-table"
import { createContentService } from "../../src/content/service"
import { compareVersionData, createVersioningService } from "../../src/content/versioning"

const testDbPath = "test-versioning.db"

const blogPost = defineCollection({
  name: "blog_post",
  labels: { singular: "Blog Post", plural: "Blog Posts" },
  fields: {
    title: field.text({ required: true }),
    slug: field.slug({ from: "title" }),
    body: field.richText(),
    status: field.select(["draft", "published"], { default: "draft" }),
  },
})

let db: ReturnType<typeof createDatabase>
let service: ReturnType<typeof createContentService>
let versioning: ReturnType<typeof createVersioningService>

describe("createVersioningService", () => {
  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [blogPost])
    const table = generateTable(blogPost)
    service = createContentService(db, blogPost, table)
    versioning = createVersioningService(db)
  })

  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("createVersion() snapshots a document", async () => {
    const doc = await service.create({ title: "Hello", status: "draft" })
    const version = versioning.createVersion("blog_post", doc.id as string, doc, "save")
    expect(version.id).toBeDefined()
    expect(version.collection).toBe("blog_post")
    expect(version.document_id).toBe(doc.id)
    expect(version.version_number).toBe(1)
    expect(version.action).toBe("save")
  })

  test("createVersion() increments version_number", async () => {
    const doc = await service.create({ title: "Hello", status: "draft" })
    versioning.createVersion("blog_post", doc.id as string, doc, "save")
    const v2 = versioning.createVersion("blog_post", doc.id as string, { ...doc, title: "Updated" }, "save")
    expect(v2.version_number).toBe(2)
  })

  test("listVersions() returns versions newest-first", async () => {
    const doc = await service.create({ title: "v1", status: "draft" })
    versioning.createVersion("blog_post", doc.id as string, doc, "save")
    versioning.createVersion("blog_post", doc.id as string, { ...doc, title: "v2" }, "save")
    versioning.createVersion("blog_post", doc.id as string, { ...doc, title: "v3" }, "publish")

    const versions = versioning.listVersions("blog_post", doc.id as string)
    expect(versions).toHaveLength(3)
    expect(versions[0].version_number).toBe(3)
    expect(versions[0].action).toBe("publish")
  })

  test("getVersion() returns a specific version", async () => {
    const doc = await service.create({ title: "Original", status: "draft" })
    const v1 = versioning.createVersion("blog_post", doc.id as string, doc, "save")

    const retrieved = versioning.getVersion(v1.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.data.title).toBe("Original")
  })

  test("getVersion() returns null for non-existent", () => {
    const result = versioning.getVersion("non-existent")
    expect(result).toBeNull()
  })

  test("version data is a full snapshot of the document", async () => {
    const doc = await service.create({ title: "Hello", body: '[]', status: "draft" })
    versioning.createVersion("blog_post", doc.id as string, doc, "save")

    await service.update(doc.id as string, { title: "Changed" })
    versioning.createVersion("blog_post", doc.id as string, { ...doc, title: "Changed" }, "save")

    const versions = versioning.listVersions("blog_post", doc.id as string)
    expect(versions[0].data.title).toBe("Changed")
    expect(versions[1].data.title).toBe("Hello")
  })

  test("compareVersionData() returns changed fields", () => {
    const changes = compareVersionData(
      { title: "Current", status: "published", tags: ["one", "two"] },
      { title: "Previous", status: "draft", tags: ["one"] },
    )

    expect(changes).toEqual([
      { field: "title", before: "Current", after: "Previous" },
      { field: "status", before: "published", after: "draft" },
      { field: "tags", before: ["one", "two"], after: ["one"] },
    ])
  })
})
