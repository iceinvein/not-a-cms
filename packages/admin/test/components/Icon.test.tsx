import React from "react"
import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { Icon } from "../../src/components/ui/Icon"

describe("Icon", () => {
  test("renders an svg for a known name, hidden from a11y tree", () => {
    const html = renderToString(<Icon name="search" />)
    expect(html).toContain("<svg")
    expect(html).toContain('aria-hidden="true"')
  })

  test("applies a custom size", () => {
    const html = renderToString(<Icon name="command" size={24} />)
    expect(html).toContain('width="24"')
    expect(html).toContain('height="24"')
  })

  test("forwards className", () => {
    const html = renderToString(<Icon name="settings" className="text-accent" />)
    expect(html).toContain("text-accent")
  })
})
