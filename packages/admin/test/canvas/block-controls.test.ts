// packages/admin/test/canvas/block-controls.test.ts
import { describe, expect, test } from "bun:test"
import { blockSpecs } from "../../src/components/continuum/blocks/specs"
import { resolveBlockControls } from "../../src/components/continuum/canvas/block-controls"

const spec = (name: string) => {
  const s = blockSpecs.find((b) => b.name === name)
  if (!s) throw new Error(`missing spec ${name}`)
  return s
}

describe("resolveBlockControls", () => {
  test("hero: variant (from align) + spacing, no columns", () => {
    const c = resolveBlockControls(spec("hero"), {})
    expect(c.variant).toEqual({ field: "align", options: ["center", "left"], value: "center" })
    expect(c.columns).toBeUndefined()
    expect(c.spacing).toEqual({ value: "normal" })
  })
  test("reads the current variant value from attrs", () => {
    expect(resolveBlockControls(spec("hero"), { align: "left" }).variant?.value).toBe("left")
  })
  test("featureGrid: columns (clamped 2..4) + spacing, no variant", () => {
    const c = resolveBlockControls(spec("featureGrid"), { columns: 4 })
    expect(c.columns).toEqual({ field: "columns", value: 4, min: 2, max: 4 })
    expect(c.variant).toBeUndefined()
    expect(c.spacing).toEqual({ value: "normal" })
  })
  test("reads the current spacing value, falling back to normal for an unknown value", () => {
    expect(resolveBlockControls(spec("cta"), { spacing: "spacious" }).spacing?.value).toBe(
      "spacious",
    )
    expect(resolveBlockControls(spec("cta"), { spacing: "bogus" }).spacing?.value).toBe("normal")
  })
  test("field-group block (image) has no controls", () => {
    expect(resolveBlockControls(spec("image"), {})).toEqual({})
  })
})
