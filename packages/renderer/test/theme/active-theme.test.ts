import { describe, expect, test } from "bun:test"
import { resolveActiveThemeCss } from "../../src/theme/default-theme"

describe("resolveActiveThemeCss (F-017 loop)", () => {
  test("falls back to the bundled default when the API theme is null", () => {
    const { variables, fontImport } = resolveActiveThemeCss(null)
    expect(variables).toContain("--paper: #faf8f4")
    expect(variables).toContain("--accent: #b4520a")
    expect(fontImport).toContain("fonts.googleapis.com")
  })

  test("merges the project theme over the default so a partial override wins", () => {
    const { variables } = resolveActiveThemeCss({
      settings: { colors: { accent: { default: "#c2410c" } } },
    })
    // overridden
    expect(variables).toContain("--accent: #c2410c")
    // untouched default still present
    expect(variables).toContain("--paper: #faf8f4")
    expect(variables).toContain("--font-display:")
  })

  test("a project font import overrides the default link url", () => {
    const { fontImport } = resolveActiveThemeCss({
      settings: { fonts: { import: { default: "https://fonts.example/custom.css" } } },
    })
    expect(fontImport).toBe("https://fonts.example/custom.css")
  })
})
