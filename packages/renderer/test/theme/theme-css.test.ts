import { describe, expect, test } from "bun:test"
import { defineTheme } from "../../src/theme/define-theme"
import { themeToCssVariables } from "../../src/theme/theme-css"

describe("themeToCssVariables (F-017)", () => {
  test("emits color settings as --<key> custom properties under :root", () => {
    const theme = defineTheme({
      name: "t",
      version: "1.0.0",
      settings: {
        colors: {
          paper: { type: "color", default: "#faf8f4" },
          accent: { type: "color", default: "#b4520a" },
        },
      },
    })
    const css = themeToCssVariables(theme)
    expect(css).toContain(":root")
    expect(css).toContain("--paper: #faf8f4")
    expect(css).toContain("--accent: #b4520a")
  })

  test("emits font settings as --font-<key> custom properties", () => {
    const theme = defineTheme({
      name: "t",
      version: "1.0.0",
      settings: {
        fonts: {
          display: { type: "text", default: '"Fraunces", serif' },
          body: { type: "text", default: '"Inter", sans-serif' },
        },
      },
    })
    const css = themeToCssVariables(theme)
    expect(css).toContain(`--font-display: "Fraunces", serif`)
    expect(css).toContain(`--font-body: "Inter", sans-serif`)
  })

  test("kebab-cases camelCase keys and skips settings without a default", () => {
    const theme = defineTheme({
      name: "t",
      version: "1.0.0",
      settings: {
        colors: {
          accentInk: { type: "color", default: "#ffffff" },
          noDefault: { type: "color" },
        },
      },
    })
    const css = themeToCssVariables(theme)
    expect(css).toContain("--accent-ink: #ffffff")
    expect(css).not.toContain("no-default")
  })

  test("returns an empty :root block for a theme with no settings", () => {
    const css = themeToCssVariables(defineTheme({ name: "t", version: "1.0.0" }))
    expect(css).toBe(":root {\n}")
  })
})
