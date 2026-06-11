// packages/admin/test/canvas/insert-menu.test.tsx
import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { InsertMenu } from "../../src/components/continuum/canvas/InsertMenu"

describe("InsertMenu", () => {
  test("renders a button for every block spec, grouped", () => {
    const html = renderToString(<InsertMenu onPick={() => {}} onClose={() => {}} />)
    expect(html).toContain("cn-insert-menu")
    // Section and field block labels both appear.
    expect(html).toContain("Hero")
    expect(html).toContain("Call to action")
    expect(html).toContain("Image")
    // Each row carries its block type for wiring the pick.
    expect(html).toContain('data-type="hero"')
    expect(html).toContain('data-type="image"')
    // Group headings appear.
    expect(html.toLowerCase()).toContain("sections")
    expect(html.toLowerCase()).toContain("fields")
  })
})
