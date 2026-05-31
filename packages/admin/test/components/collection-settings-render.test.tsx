import React from "react"
import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { CollectionSettings } from "../../src/components/CollectionSettings"

describe("CollectionSettings", () => {
  test("renders per-collection tabs and settings controls", () => {
    const html = renderToString(
      <CollectionSettings
        apiBase="https://cms.example.test"
        initialRoles={[
          { key: "admin", label: "Admin" },
          { key: "editor", label: "Editor" },
          { key: "viewer", label: "Viewer" },
        ]}
        initialCollections={[
          {
            name: "blog_post",
            labels: { singular: "Blog Post", plural: "Blog Posts" },
            fields: {
              title: { type: "text" },
              body: { type: "richText" },
            },
            settings: {
              labels: { singular: "Article", plural: "Articles" },
              access: { read: ["viewer"], update: ["editor"] },
              previewPath: "/blog/:slug",
              searchFields: ["title"],
              editorLayout: "sidebar",
            },
          },
          {
            name: "page",
            labels: { singular: "Page", plural: "Pages" },
            fields: { title: { type: "text" } },
            settings: {},
          },
        ]}
      />,
    )

    expect(html).toContain("Collection Settings")
    expect(html).toContain("Blog Posts")
    expect(html).toContain("Pages")
    expect(html).toContain("Article")
    expect(html).toContain("/blog/:slug")
    expect(html).toContain("Search fields")
    expect(html).toContain("Editor layout")
    expect(html).toContain("Read")
    expect(html).toContain("Viewer")
    expect(html).toContain("Code-defined fields")
    expect(html).toContain("title")
    expect(html).toContain("richText")
  })
})
