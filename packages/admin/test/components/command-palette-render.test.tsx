import React from "react"
import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { CommandPalette } from "../../src/components/command/CommandPalette"

const collections = [
  { name: "blog_post", labels: { singular: "Blog Post", plural: "Blog Posts" }, fields: {} },
]

describe("CommandPalette", () => {
  test("renders nothing when closed (default)", () => {
    const html = renderToString(
      <CommandPalette apiBase="" siteBase="http://s" collections={collections} pathname="/" />,
    )
    expect(html).toBe("")
  })

  test("when forced open, renders a combobox with scope tabs and jump results", () => {
    const html = renderToString(
      <CommandPalette
        apiBase=""
        siteBase="http://s"
        collections={collections}
        pathname="/"
        defaultOpen
      />,
    )
    expect(html).toContain('role="combobox"')
    expect(html).toContain('role="listbox"')
    expect(html).toContain("Blog Posts")
    expect(html).toContain("Dashboard")
    expect(html).toContain("Jump to")
    expect(html).toContain("Find in content")
  })
})
