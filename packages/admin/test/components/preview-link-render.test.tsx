import { describe, expect, test } from "bun:test"
import React from "react"
import { renderToString } from "react-dom/server"
import { PreviewLink } from "../../src/components/PreviewLink"

describe("PreviewLink", () => {
  test("renders preview lifecycle controls", () => {
    const html = renderToString(
      <PreviewLink
        collection="blog_post"
        documentId="doc-123"
        apiBase="https://cms.example.test"
        siteBase="https://site.example.test"
      />,
    )

    expect(html).toContain("Generate Preview Link")
    expect(html).toContain("Regenerate")
    expect(html).toContain("Revoke")
  })
})
