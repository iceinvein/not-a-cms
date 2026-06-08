import { describe, expect, test } from "bun:test"
import { scopeThemeVariables } from "../../src/components/continuum/canvas/scope-theme"

describe("scopeThemeVariables", () => {
  test("rewrites the :root selector to the given container selector", () => {
    const input = ":root {\n  --ink: #1c1917;\n  --accent: #c2613f;\n}"
    const out = scopeThemeVariables(input, ".cn-visual")
    expect(out).toBe(".cn-visual {\n  --ink: #1c1917;\n  --accent: #c2613f;\n}")
    expect(out).not.toContain(":root")
  })

  test("leaves an empty string untouched", () => {
    expect(scopeThemeVariables("", ".cn-visual")).toBe("")
  })
})
