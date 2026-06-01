import React from "react"
import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { Continuum, shouldEnableContinuumCollaboration } from "../../src/components/continuum/Continuum"

describe("Continuum", () => {
  test("renders the canvas chrome: title field, status bar, and mirror", () => {
    const html = renderToString(
      <Continuum
        collection="blog_post"
        collectionLabel="Blog Post"
        fields={{ title: { type: "text" }, body: { type: "richText" } }}
        apiBase=""
        siteBase="http://s"
      />,
    )
    expect(html).toContain("Channel mirror")
    expect(html).toContain("publish")
  })

  test("renders document status from data", () => {
    const html = renderToString(
      <Continuum
        collection="blog_post"
        collectionLabel="Blog Post"
        fields={{ title: { type: "text" }, status: { type: "select" }, body: { type: "richText" } }}
        initialData={{ title: "Published", status: "published" }}
        apiBase=""
        siteBase="http://s"
      />,
    )
    expect(html).toContain("published")
  })

  test("keeps collaboration enabled after local edits when the saved body started empty", () => {
    expect(shouldEnableContinuumCollaboration({
      documentId: "doc-1",
      initialBlockCount: 0,
      currentBlockCount: 1,
    })).toBe(true)
  })
})
