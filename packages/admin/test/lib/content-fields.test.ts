import { describe, expect, test } from "bun:test"
import {
  addArrayItem,
  coerceArrayValue,
  emptyValueForField,
  formatDateTimeInput,
  panelFields,
  parseDateTimeInput,
  prepareValueForField,
  removeArrayItem,
} from "../../src/lib/content-fields"

describe("admin content field helpers", () => {
  test("creates empty values that match field types", () => {
    expect(emptyValueForField({ type: "text", required: false })).toBe("")
    expect(emptyValueForField({ type: "number", required: false })).toBe(0)
    expect(emptyValueForField({ type: "boolean", required: false })).toBe(false)
    expect(emptyValueForField({ type: "media", required: false })).toBeNull()
    expect(emptyValueForField({ type: "array", required: false, items: { type: "text", required: false } })).toEqual([])
    expect(emptyValueForField({
      type: "group",
      required: false,
      fields: {
        metaTitle: { type: "text", required: false },
        featured: { type: "boolean", required: false },
      },
    })).toEqual({ metaTitle: "", featured: false })
  })

  test("keeps array fields as arrays and edits by index", () => {
    const itemField = { type: "text", required: false }

    expect(coerceArrayValue(undefined)).toEqual([])
    expect(addArrayItem(["one"], itemField)).toEqual(["one", ""])
    expect(removeArrayItem(["one", "two"], 0)).toEqual(["two"])
  })

  test("prepares API values without stringifying structured fields", () => {
    expect(prepareValueForField(["one"], { type: "array", items: { type: "text" } })).toEqual(["one"])
    expect(prepareValueForField({ metaTitle: "SEO" }, { type: "group", fields: { metaTitle: { type: "text" } } })).toEqual({ metaTitle: "SEO" })
    expect(prepareValueForField("media-1", { type: "media" })).toBe("media-1")
    expect(prepareValueForField("author-1", { type: "relation" })).toBe("author-1")
  })

  test("panelFields lists editable metadata fields, skipping title, body, and excluded names", () => {
    const fields = {
      title: { type: "text" },
      slug: { type: "slug", from: "title" },
      body: { type: "richText" },
      tags: { type: "array", items: { type: "text" } },
      status: { type: "select", options: ["draft", "published"] },
      publishedAt: { type: "datetime" },
    }
    const result = panelFields(fields, ["title", "status"])
    expect(result.map(([name]) => name)).toEqual(["slug", "tags", "publishedAt"])
  })

  test("clears datetime values instead of creating invalid dates", () => {
    expect(parseDateTimeInput("")).toBe("")
    expect(parseDateTimeInput("2026-05-31T09:30")).toBe("2026-05-31T09:30:00.000Z")
    expect(formatDateTimeInput("2026-05-31T09:30:00.000Z")).toBe("2026-05-31T09:30")
    expect(formatDateTimeInput("not-a-date")).toBe("")
  })
})
