import { describe, expect, test } from "bun:test"
import { renderPortableText } from "@not-a-cms/renderer/web"
import { renderSectionHtml } from "../../src/components/continuum/canvas/render-section"

describe("renderSectionHtml", () => {
  test("matches the production renderer for a hero block", () => {
    const attrs = { eyebrow: "Beta", headline: "Ship pages", subheadline: "Fast", align: "center" }
    const expected = renderPortableText([{ type: "hero", ...attrs }], "web")
    expect(renderSectionHtml("hero", attrs)).toBe(expected)
  })

  test("renders the section markup, not an empty string, for a CTA", () => {
    const html = renderSectionHtml("cta", { label: "Buy", url: "/pricing", variant: "primary" })
    expect(html).toContain("nac-cta")
    expect(html).toContain("Buy")
  })
})
