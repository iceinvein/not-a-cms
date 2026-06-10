import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { renderSectionHtml } from "../../../src/components/continuum/canvas/render-section"
import { SeoLiving } from "../../../src/components/continuum/canvas/living/SeoLiving"

describe("SeoLiving", () => {
  test("static mode renders nothing, matching the empty production output", () => {
    const attrs = { metaTitle: "Title", metaDescription: "Desc" }
    expect(renderToString(<SeoLiving attrs={attrs} editable={false} />)).toBe("")
    expect(renderSectionHtml("seo", attrs)).toBe("")
  })

  test("editable mode renders a selectable chip", () => {
    const html = renderToString(<SeoLiving attrs={{ metaTitle: "", metaDescription: "" }} editable />)
    expect(html).toContain("cn-seo-chip")
    expect(html).toContain("SEO")
  })
})
