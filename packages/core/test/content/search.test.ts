import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { unlinkSync } from "node:fs"
import { createDatabase } from "../../src/db/connection"
import { bootstrapTables } from "../../src/db/bootstrap"
import { defineCollection } from "../../src/schema/collection"
import { field } from "../../src/schema/field"
import { createSearchService } from "../../src/content/search"

const testDbPath = "test-search.db"

const blogPost = defineCollection({
  name: "blog_post",
  labels: { singular: "Blog Post", plural: "Blog Posts" },
  fields: {
    title: field.text({ required: true }),
    body: field.richText(),
    status: field.select(["draft", "published"], { default: "draft" }),
  },
})

let db: ReturnType<typeof createDatabase>
let search: ReturnType<typeof createSearchService>

describe("createSearchService", () => {
  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [blogPost])
    search = createSearchService(db)
  })

  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("index() adds a document to the search index", () => {
    search.index("blog_post", "doc-1", "Hello World", "This is the body text")
    const results = search.query("Hello")
    expect(results).toHaveLength(1)
    expect(results[0].document_id).toBe("doc-1")
    expect(results[0].collection).toBe("blog_post")
  })

  test("query() returns empty array for no matches", () => {
    search.index("blog_post", "doc-1", "Hello World", "Body")
    const results = search.query("nonexistent")
    expect(results).toHaveLength(0)
  })

  test("query() matches partial words with prefix search", () => {
    search.index("blog_post", "doc-1", "Authentication Guide", "How to set up auth")
    const results = search.query("auth")
    expect(results).toHaveLength(1)
  })

  test("query() searches across title and body", () => {
    search.index("blog_post", "doc-1", "Title One", "unique-body-keyword")
    const results = search.query("unique-body-keyword")
    expect(results).toHaveLength(1)
  })

  test("query() can filter by collection", () => {
    search.index("blog_post", "doc-1", "Blog Title", "body")
    search.index("page", "doc-2", "Page Title", "body")
    const results = search.query("Title", "blog_post")
    expect(results).toHaveLength(1)
    expect(results[0].collection).toBe("blog_post")
  })

  test("update() replaces an existing index entry", () => {
    search.index("blog_post", "doc-1", "Old Title", "old body")
    search.update("blog_post", "doc-1", "New Title", "new body")
    const oldResults = search.query("Old")
    expect(oldResults).toHaveLength(0)
    const newResults = search.query("New")
    expect(newResults).toHaveLength(1)
  })

  test("remove() deletes from the index", () => {
    search.index("blog_post", "doc-1", "Hello World", "body")
    search.remove("blog_post", "doc-1")
    const results = search.query("Hello")
    expect(results).toHaveLength(0)
  })
})
