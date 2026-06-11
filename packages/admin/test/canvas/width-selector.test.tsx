import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { WidthSelector } from "../../src/components/continuum/canvas/WidthSelector"

describe("WidthSelector", () => {
  test("renders three presets with the active one pressed", () => {
    const html = renderToString(<WidthSelector value="mobile" onChange={() => {}} />)
    expect(html).toContain("cn-width-selector")
    expect(html).toContain('data-width="desktop"')
    expect(html).toContain('data-width="tablet"')
    expect(html).toContain('data-width="mobile"')
    expect(html).toMatch(/data-width="mobile"[^>]*aria-pressed="true"/)
    expect(html).toMatch(/data-width="desktop"[^>]*aria-pressed="false"/)
  })
})
