import { describe, expect, test } from "bun:test"
import { brandCss } from "../../src/theme/brand-css"

describe("brandCss chrome self-sufficiency", () => {
  test("styles the header layout without relying on Tailwind utilities", () => {
    expect(brandCss).toContain(".nac-header-inner")
    expect(brandCss).toContain(".nac-wordmark")
    expect(brandCss).toContain(".nac-nav-link")
  })
  test("gives the header a border and background", () => {
    expect(brandCss).toMatch(/\.nac-header\s*\{[^}]*border-bottom/)
  })
  test("styles the footer layout and typography", () => {
    expect(brandCss).toContain(".nac-footer-inner")
    expect(brandCss).toContain(".nac-footer-col-heading")
    expect(brandCss).toContain(".nac-footer-col-list")
    expect(brandCss).toContain(".nac-footer-link")
    expect(brandCss).toContain(".nac-footer-social-link")
    expect(brandCss).toContain(".nac-footer-legal")
  })
  test("gives footer columns a base 4-column grid with responsive steps", () => {
    expect(brandCss).toMatch(/\.nac-footer-columns\s*\{[^}]*grid-template-columns:\s*repeat\(4/)
  })
})
