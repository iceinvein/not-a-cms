import React from "react"
import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { Continuum } from "../../src/components/continuum/Continuum"

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
})
