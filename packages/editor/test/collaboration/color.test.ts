import { describe, expect, test } from "bun:test"
import { readableTextColor, safeCssColor } from "../../src/collaboration/color"

describe("safeCssColor", () => {
  test("passes through valid hex, rgb, and hsl", () => {
    expect(safeCssColor("#c9956b")).toBe("#c9956b")
    expect(safeCssColor("#fff")).toBe("#fff")
    expect(safeCssColor("rgb(10, 20, 30)")).toBe("rgb(10, 20, 30)")
    expect(safeCssColor("hsl(200, 50%, 40%)")).toBe("hsl(200, 50%, 40%)")
  })

  test("falls back to a safe color for anything else", () => {
    expect(safeCssColor("red; background: url(x)")).toBe("#38bdf8")
    expect(safeCssColor("javascript:alert(1)")).toBe("#38bdf8")
    expect(safeCssColor("")).toBe("#38bdf8")
  })
})

describe("readableTextColor", () => {
  test("returns dark text on a light background and light text on a dark one", () => {
    expect(readableTextColor("#ffffff")).toBe("#0a0a0c")
    expect(readableTextColor("#000000")).toBe("#fafafa")
  })

  test("expands 3-digit hex and falls back for non-hex input", () => {
    expect(readableTextColor("#fff")).toBe("#0a0a0c")
    expect(readableTextColor("rgb(0,0,0)")).toBe("#fafafa")
  })
})
