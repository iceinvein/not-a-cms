// packages/admin/test/canvas/block-controls-ui.test.tsx
import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { blockSpecs } from "../../src/components/continuum/blocks/specs"
import {
  BlockControls,
  ColumnStepper,
  VariantPopover,
} from "../../src/components/continuum/canvas/BlockControls"

const spec = (name: string) => {
  const s = blockSpecs.find((b) => b.name === name)
  if (!s) throw new Error(`missing spec ${name}`)
  return s
}

describe("BlockControls", () => {
  test("hero renders the variant and spacing affordances, not columns", () => {
    const html = renderToString(<BlockControls spec={spec("hero")} attrs={{}} commit={() => {}} />)
    expect(html).toContain("cn-gutter")
    expect(html).toContain("cn-gutter-variant")
    expect(html).toContain("cn-gutter-spacing")
    expect(html).not.toContain("cn-gutter-columns")
  })
  test("featureGrid renders the columns and spacing affordances, not variant", () => {
    const html = renderToString(
      <BlockControls spec={spec("featureGrid")} attrs={{}} commit={() => {}} />,
    )
    expect(html).toContain("cn-gutter-columns")
    expect(html).toContain("cn-gutter-spacing")
    expect(html).not.toContain("cn-gutter-variant")
  })
  test("a field-group block renders an empty gutter", () => {
    const html = renderToString(<BlockControls spec={spec("image")} attrs={{}} commit={() => {}} />)
    expect(html).toContain("cn-gutter")
    expect(html).not.toContain("cn-gutter-variant")
    expect(html).not.toContain("cn-gutter-columns")
    expect(html).not.toContain("cn-gutter-spacing")
  })
})

describe("VariantPopover", () => {
  test("lists options with the current one marked active", () => {
    const html = renderToString(
      <VariantPopover options={["center", "left"]} value="left" onPick={() => {}} />,
    )
    expect(html).toContain('data-value="center"')
    expect(html).toContain('data-value="left"')
    expect(html).toMatch(/data-value="left"[^>]*data-active="true"/)
  })
})

describe("ColumnStepper", () => {
  test("shows the count and disables the minus at the floor", () => {
    const html = renderToString(<ColumnStepper value={2} min={2} max={4} onStep={() => {}} />)
    expect(html).toContain('data-count="2"')
    expect(html).toMatch(/aria-label="Fewer columns"[^>]*disabled/)
  })
})
