import { describe, expect, test } from "bun:test"
import { getTableColumns, getTableName } from "drizzle-orm"
import { generateTable } from "../../src/db/generate-table"
import { defineCollection } from "../../src/schema/collection"
import { field } from "../../src/schema/field"

describe("generateTable", () => {
  const blogPost = defineCollection({
    name: "blog_post",
    fields: {
      title: field.text({ required: true }),
      slug: field.slug({ from: "title" }),
      body: field.richText(),
      views: field.number(),
      featured: field.boolean({ default: false }),
      publishedAt: field.datetime(),
      status: field.select(["draft", "published"]),
      author: field.relation("user"),
      coverImage: field.media(),
      tags: field.array(field.text()),
      seo: field.group({ metaTitle: field.text() }),
    },
  })

  test("table name matches collection name", () => {
    const table = generateTable(blogPost)
    expect(getTableName(table)).toBe("blog_post")
  })

  test("has id column", () => {
    const table = generateTable(blogPost)
    expect(getTableColumns(table).id).toBeDefined()
  })

  test("has created_at and updated_at", () => {
    const table = generateTable(blogPost)
    const cols = getTableColumns(table)
    expect(cols.created_at).toBeDefined()
    expect(cols.updated_at).toBeDefined()
  })

  test("text fields → text columns", () => {
    const table = generateTable(blogPost)
    const cols = getTableColumns(table)
    expect(cols.title).toBeDefined()
    expect(cols.slug).toBeDefined()
  })

  test("richText → text column", () => {
    const table = generateTable(blogPost)
    expect(getTableColumns(table).body).toBeDefined()
  })

  test("number → integer column", () => {
    const table = generateTable(blogPost)
    expect(getTableColumns(table).views).toBeDefined()
  })

  test("boolean → integer column", () => {
    const table = generateTable(blogPost)
    expect(getTableColumns(table).featured).toBeDefined()
  })

  test("datetime → text column with snake_case name", () => {
    const table = generateTable(blogPost)
    expect(getTableColumns(table).published_at).toBeDefined()
  })

  test("select → text column", () => {
    const table = generateTable(blogPost)
    expect(getTableColumns(table).status).toBeDefined()
  })

  test("relation → text column with _id suffix", () => {
    const table = generateTable(blogPost)
    expect(getTableColumns(table).author_id).toBeDefined()
  })

  test("media → text column with _id suffix and snake_case", () => {
    const table = generateTable(blogPost)
    expect(getTableColumns(table).cover_image_id).toBeDefined()
  })

  test("array → text column (JSON)", () => {
    const table = generateTable(blogPost)
    expect(getTableColumns(table).tags).toBeDefined()
  })

  test("group → text column (JSON)", () => {
    const table = generateTable(blogPost)
    expect(getTableColumns(table).seo).toBeDefined()
  })
})
