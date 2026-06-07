import { describe, expect, test } from "bun:test"
import { defineTheme } from "../../src/theme/define-theme"
import {
  cssVariablesFromSettings,
  mergeResolvedSettings,
  resolveThemeSettings,
  themeToCssVariables,
} from "../../src/theme/theme-css"

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

describe("resolveThemeSettings", () => {
  test("flattens field defaults to values and skips missing defaults", () => {
    const resolved = resolveThemeSettings({
      settings: {
        colors: { paper: { type: "color", default: "#fff" }, none: { type: "color" } },
        fonts: { body: { type: "text", default: "Inter" } },
      },
    } as any)
    expect(resolved).toEqual({ colors: { paper: "#fff" }, fonts: { body: "Inter" } })
  })

  test("tolerates null/undefined themes", () => {
    expect(resolveThemeSettings(null)).toEqual({})
    expect(resolveThemeSettings(undefined)).toEqual({})
  })
})

describe("mergeResolvedSettings", () => {
  test("overlays override values onto the base, keeping untouched base keys", () => {
    const base = { colors: { paper: "#fff", accent: "#000" }, fonts: { body: "Inter" } }
    const override = { colors: { accent: "#b4520a" } }
    expect(mergeResolvedSettings(base, override)).toEqual({
      colors: { paper: "#fff", accent: "#b4520a" },
      fonts: { body: "Inter" },
    })
  })
})

describe("cssVariablesFromSettings", () => {
  test("emits vars and excludes fonts.import (a <link> url, not a style value)", () => {
    const css = cssVariablesFromSettings({
      colors: { accent: "#b4520a" },
      fonts: { display: "Fraunces", import: "https://fonts.example/x.css" },
    })
    expect(css).toContain("--accent: #b4520a")
    expect(css).toContain("--font-display: Fraunces")
    expect(css).not.toContain("font-import")
  })
})
