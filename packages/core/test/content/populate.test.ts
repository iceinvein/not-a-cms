import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import { sql } from "drizzle-orm"
import { createDatabase } from "../../src/db/connection"
import { generateTable } from "../../src/db/generate-table"
import { defineCollection } from "../../src/schema/collection"
import { field } from "../../src/schema/field"
import { createContentService } from "../../src/content/service"
import { populateDocuments } from "../../src/content/populate"

const testDbPath = "test-populate.db"

const author = defineCollection({
  name: "author",
  fields: {
    name: field.text({ required: true }),
    secret: field.text({ access: { read: ["admin"] } }),
  },
})

const page = defineCollection({
  name: "page",
  fields: {
    title: field.text({ required: true }),
    author: field.relation("author"),
    coverImage: field.media({ accept: ["image/*"] }),
  },
})

describe("populateDocuments", () => {
  let db: ReturnType<typeof createDatabase>
  let authorService: ReturnType<typeof createContentService>
  let pageService: ReturnType<typeof createContentService>

  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    db.run(sql`CREATE TABLE IF NOT EXISTS author (id TEXT PRIMARY KEY, name TEXT NOT NULL, secret TEXT, created_at TEXT, updated_at TEXT)`)
    db.run(sql`CREATE TABLE IF NOT EXISTS page (id TEXT PRIMARY KEY, title TEXT NOT NULL, author_id TEXT, cover_image_id TEXT, created_at TEXT, updated_at TEXT)`)
    authorService = createContentService(db, author, generateTable(author))
    pageService = createContentService(db, page, generateTable(page))
  })

  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("populates relation and media fields while projecting target fields by role", async () => {
    const createdAuthor = await authorService.create({ name: "Ada", secret: "private" })
    const doc = await pageService.create({ title: "Populated", author: createdAuthor.id, coverImage: "media-1" })

    const [populated] = await populateDocuments([doc], page, {
      populate: ["author", "coverImage"],
      role: "viewer",
      collections: new Map([
        ["author", { def: author, service: authorService }],
        ["page", { def: page, service: pageService }],
      ]),
      media: {
        get: (id) => id === "media-1" ? { id, filename: "cover.png", url: `/api/media/${id}/file` } : null,
      },
    })

    expect(populated.author).toEqual(expect.objectContaining({ id: createdAuthor.id, name: "Ada" }))
    expect(populated.author).not.toHaveProperty("secret")
    expect(populated.coverImage).toEqual({ id: "media-1", filename: "cover.png", url: "/api/media/media-1/file" })
  })
})
