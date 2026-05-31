import React from "react"
import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { ContentEditor, portableTextValue } from "../../src/components/ContentEditor"

describe("ContentEditor field rendering", () => {
  test("renders schema-aware controls for scaffolded blog fields", () => {
    const html = renderToString(
      <ContentEditor
        collection="blog_post"
        collectionLabel="Blog Post"
        apiBase="https://cms.example.test"
        fields={{
          title: { type: "text", required: true },
          coverImage: { type: "media", required: false, accept: ["image/*"] },
          tags: { type: "array", required: false, items: { type: "text", required: false } },
          seo: {
            type: "group",
            required: false,
            fields: {
              metaTitle: { type: "text", required: false },
              metaDescription: { type: "text", required: false, maxLength: 160 },
            },
          },
          author: { type: "relation", required: false, target: "author" },
          status: { type: "select", required: false, options: ["draft", "in_review", "published", "archived", "scheduled"], default: "draft" },
          publishedAt: { type: "datetime", required: false },
        }}
        initialData={{
          title: "First post",
          tags: ["cms"],
          seo: { metaTitle: "SEO title", metaDescription: "SEO description" },
        }}
      />,
    )

    expect(html).toContain("Cover Image")
    expect(html).toContain("Select media")
    expect(html).toContain("Tags")
    expect(html).toContain("Add item")
    expect(html).toContain("Seo")
    expect(html).toContain("Meta Title")
    expect(html).toContain("Author")
    expect(html).toContain("Search author")
    expect(html).toContain("Select author")
    expect(html).toContain("Save Draft")
    expect(html).toContain("Submit Review")
    expect(html).toContain("Publish")
    expect(html).toContain("Schedule")
    expect(html).toContain("Schedule publish")
    expect(html).toContain("Archive")
  })

  test("enables live editing only for saved rich text documents", () => {
    const savedHtml = renderToString(
      <ContentEditor
        collection="blog_post"
        collectionLabel="Blog Post"
        apiBase="https://cms.example.test"
        documentId="doc-1"
        fields={{ body: { type: "richText", required: false } }}
        initialData={{ body: "[]" }}
      />,
    )

    const newHtml = renderToString(
      <ContentEditor
        collection="blog_post"
        collectionLabel="Blog Post"
        apiBase="https://cms.example.test"
        fields={{ body: { type: "richText", required: false } }}
        initialData={{ body: "[]" }}
      />,
    )

    expect(savedHtml).toContain("Live editing")
    expect(newHtml).not.toContain("Live editing")
  })

  test("keeps live editing disabled when saved rich text has persisted content", () => {
    const html = renderToString(
      <ContentEditor
        collection="blog_post"
        collectionLabel="Blog Post"
        apiBase="https://cms.example.test"
        documentId="doc-1"
        fields={{ body: { type: "richText", required: false } }}
        initialData={{ body: [{ type: "paragraph", children: [{ type: "text", value: "Saved body" }] }] }}
      />,
    )

    expect(html).not.toContain("Live editing")
  })

  test("normalizes rich text values from API arrays and legacy JSON strings", () => {
    const blocks = [{ type: "paragraph", children: [{ type: "text", value: "Saved body" }] }]

    expect(portableTextValue(blocks)).toEqual(blocks)
    expect(portableTextValue(JSON.stringify(blocks))).toEqual(blocks)
    expect(portableTextValue("")).toBeUndefined()
  })
})
