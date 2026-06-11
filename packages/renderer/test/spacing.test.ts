// packages/renderer/test/spacing.test.ts
import { describe, expect, test } from "bun:test"
import { renderPortableText } from "../src/runtime/portable-text-html"

const render = (block: Record<string, unknown>) => renderPortableText([block] as never, "web")

describe("section spacing", () => {
  test("a non-default spacing emits data-spacing on the band", () => {
    expect(render({ type: "hero", headline: "Hi", spacing: "spacious" })).toContain(
      'data-spacing="spacious"',
    )
    expect(render({ type: "featureGrid", items: [], spacing: "compact" })).toContain(
      'data-spacing="compact"',
    )
  })
  test("normal and missing spacing emit no attribute (byte-identical default)", () => {
    expect(render({ type: "hero", headline: "Hi", spacing: "normal" })).not.toContain(
      "data-spacing",
    )
    expect(render({ type: "hero", headline: "Hi" })).not.toContain("data-spacing")
  })
})
