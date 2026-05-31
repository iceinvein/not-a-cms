import { test, expect, describe } from "bun:test"
import { defineTheme } from "../../src/theme/define-theme"

describe("defineTheme", () => {
  test("creates a theme with name and version", () => {
    const theme = defineTheme({ name: "starter", version: "1.0.0" })
    expect(theme.name).toBe("starter")
    expect(theme.version).toBe("1.0.0")
  })

  test("preserves all properties", () => {
    const theme = defineTheme({
      name: "starter",
      version: "1.0.0",
      description: "A starter theme",
      author: "not-a-cms",
    })
    expect(theme.description).toBe("A starter theme")
    expect(theme.author).toBe("not-a-cms")
  })

  test("getDefault returns setting default value", () => {
    const theme = defineTheme({
      name: "starter",
      version: "1.0.0",
      settings: {
        colors: {
          primary: { type: "color", default: "#2563eb", label: "Primary Color" },
          background: { type: "color", default: "#ffffff" },
        },
        layout: {
          maxWidth: { type: "select", options: ["narrow", "medium", "wide"], default: "medium" },
        },
      },
    })
    expect(theme.getDefault("colors", "primary")).toBe("#2563eb")
    expect(theme.getDefault("layout", "maxWidth")).toBe("medium")
  })

  test("getDefault returns null for missing settings", () => {
    const theme = defineTheme({ name: "minimal", version: "1.0.0" })
    expect(theme.getDefault("colors", "primary")).toBeNull()
  })

  test("getDefault returns null for missing section", () => {
    const theme = defineTheme({
      name: "starter",
      version: "1.0.0",
      settings: {
        colors: { primary: { type: "color", default: "#000" } },
      },
    })
    expect(theme.getDefault("layout", "anything")).toBeNull()
  })

  test("defines component renderer overrides as part of the theme manifest", () => {
    const theme = defineTheme({
      name: "starter",
      version: "1.0.0",
      components: {
        hero: (props) => `<h1>${props.headline}</h1>`,
      },
    })

    expect(theme.components?.hero({ headline: "Custom Hero" })).toBe("<h1>Custom Hero</h1>")
  })
})
