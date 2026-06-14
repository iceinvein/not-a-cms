import { describe, expect, test } from "bun:test"
import { contrastRatio } from "../../src/lib/contrast"

describe("contrastRatio", () => {
  // Sanity-check the WCAG relative-luminance math against known pairs.
  test("black on white is 21:1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0)
  })

  test("identical colors are 1:1", () => {
    expect(contrastRatio("#18181b", "#18181b")).toBeCloseTo(1, 5)
  })

  test("is order-independent", () => {
    expect(contrastRatio("#71717a", "#18181b")).toBeCloseTo(contrastRatio("#18181b", "#71717a"), 5)
  })

  // The original muted/subtle ramp failed AA on the surface background (the critique
  // measured 3.7:1 and 2.6:1); this records the regression we're fixing.
  test("the OLD gray ramp fails WCAG AA on the surface background", () => {
    expect(contrastRatio("#71717a", "#18181b")).toBeLessThan(4.5)
    expect(contrastRatio("#52525b", "#0a0a0c")).toBeLessThan(4.5)
  })

  // The shipped --text-muted / --text-subtle values (global.css :root). If these change in
  // CSS, change them here too: they MUST clear AA on every background dim text sits on.
  const MUTED = "#909099"
  const SUBTLE = "#838389"
  const TEXT_BACKGROUNDS = ["#0a0a0c", "#111113", "#18181b"] // app, sidebar, surface

  test("the NEW gray ramp clears WCAG AA on every text background", () => {
    for (const bg of TEXT_BACKGROUNDS) {
      expect(contrastRatio(MUTED, bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(SUBTLE, bg)).toBeGreaterThanOrEqual(4.5)
    }
  })

  test("the ramp keeps a descending hierarchy: secondary > muted > subtle", () => {
    const onSurface = (hex: string) => contrastRatio(hex, "#18181b")
    expect(onSurface("#a1a1aa")).toBeGreaterThan(onSurface(MUTED))
    expect(onSurface(MUTED)).toBeGreaterThan(onSurface(SUBTLE))
  })
})
