import { describe, expect, test } from "bun:test"
import { defineCollection } from "../../src/schema/collection"
import { field } from "../../src/schema/field"
import { applyGeneratedSlugs } from "../../src/content/slug"

const collection = defineCollection({
  name: "page",
  fields: {
    title: field.text({ required: true }),
    slug: field.slug({ from: "title" }),
  },
})

describe("applyGeneratedSlugs", () => {
  test("generates a slug from the source field when slug is missing", () => {
    const doc = applyGeneratedSlugs(collection, { title: "Hello World" })
    expect(doc.slug).toBe("hello-world")
  })

  test("generates a slug when slug is an empty string", () => {
    const doc = applyGeneratedSlugs(collection, { title: "Pricing & Plans", slug: "" })
    expect(doc.slug).toBe("pricing-plans")
  })

  test("respects an explicitly provided slug", () => {
    const doc = applyGeneratedSlugs(collection, { title: "Hello World", slug: "custom-slug" })
    expect(doc.slug).toBe("custom-slug")
  })

  test("leaves the slug empty when the source field is empty", () => {
    const doc = applyGeneratedSlugs(collection, { title: "" })
    expect(doc.slug ?? "").toBe("")
  })

  test("does not mutate the input document", () => {
    const input = { title: "Hello World" }
    applyGeneratedSlugs(collection, input)
    expect("slug" in input).toBe(false)
  })
})
