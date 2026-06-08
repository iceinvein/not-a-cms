import { describe, expect, test } from "bun:test"
import { compileInlineStyle, compileStyles } from "../../src/builder/style-compiler"

describe("compileStyles", () => {
  test("compiles a style map to CSS string", () => {
    const styles = {
      "hero-bg": {
        "background-color": "#1a1a2e",
        color: "#ffffff",
        padding: "64px 32px",
      },
      centered: {
        "text-align": "center",
        margin: "0 auto",
      },
    }
    const css = compileStyles(styles)
    expect(css).toContain(".hero-bg")
    expect(css).toContain("background-color:#1a1a2e")
    expect(css).toContain(".centered")
    expect(css).toContain("text-align:center")
  })

  test("escapes class names with special characters", () => {
    const styles = { "my class": { color: "red" } }
    const css = compileStyles(styles)
    expect(css).toContain(".my\\ class")
  })

  test("empty styles returns empty string", () => {
    expect(compileStyles({})).toBe("")
  })
})

describe("compileInlineStyle", () => {
  test("converts style object to inline CSS string", () => {
    const result = compileInlineStyle({
      "background-color": "#fff",
      padding: "16px",
      "font-size": "14px",
    })
    expect(result).toBe("background-color:#fff;padding:16px;font-size:14px")
  })

  test("empty object returns empty string", () => {
    expect(compileInlineStyle({})).toBe("")
  })
})
