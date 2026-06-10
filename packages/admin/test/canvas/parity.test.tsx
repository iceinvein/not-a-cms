// packages/admin/test/canvas/parity.test.tsx
import { describe, expect, test } from "bun:test"
import { normalizeCanvasHtml } from "./parity"

describe("normalizeCanvasHtml", () => {
  test("collapses inter-tag whitespace and trims", () => {
    expect(normalizeCanvasHtml("<div>\n  <p>Hi</p>\n</div>")).toBe("<div><p>Hi</p></div>")
  })

  test("preserves text content spacing inside a tag", () => {
    expect(normalizeCanvasHtml("<p>Ship  pages</p>")).toBe("<p>Ship pages</p>")
  })

  test("normalizes self-closing voids: renderer ' />' and React '/>' both become '>'", () => {
    expect(normalizeCanvasHtml('<img src="/a.jpg" alt="" />')).toBe('<img src="/a.jpg" alt="">')
    expect(normalizeCanvasHtml('<img src="/a.jpg" alt=""/>')).toBe('<img src="/a.jpg" alt="">')
    expect(normalizeCanvasHtml("<hr />")).toBe("<hr>")
  })

  test("strips valueless data attributes (renderer 'data-x' vs React 'data-x=\"\"')", () => {
    expect(normalizeCanvasHtml('<div data-author=""><span data-author-name="">A</span></div>')).toBe(
      "<div data-author><span data-author-name>A</span></div>",
    )
  })

  test("decodes apostrophes so React's &#x27; matches the renderer's raw '", () => {
    expect(normalizeCanvasHtml("<p>Don&#x27;t stop</p>")).toBe("<p>Don't stop</p>")
    expect(normalizeCanvasHtml('<section style="background-image:url(&#x27;/a.jpg&#x27;)">x</section>')).toBe(
      "<section style=\"background-image:url('/a.jpg')\">x</section>",
    )
  })

  test("is idempotent", () => {
    const once = normalizeCanvasHtml('<section>\n<div data-x=""> a </div><img alt="" />\n</section>')
    expect(normalizeCanvasHtml(once)).toBe(once)
  })
})
