import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { FreshnessRow } from "../../../src/components/pulse/FreshnessRow"

describe("FreshnessRow", () => {
  test("a fresh row glows and exposes its intensity as a CSS var", () => {
    const html = renderToString(
      <FreshnessRow intensity={0.8}>
        <span>Pricing page</span>
      </FreshnessRow>,
    )
    expect(html).toContain("pulse-fresh")
    expect(html).toContain("--pulse-freshness:0.800")
    expect(html).toContain("Pricing page")
  })

  test("a neutral row is not marked fresh; a dormant row dims", () => {
    const neutral = renderToString(
      <FreshnessRow intensity={0}>
        <span>Old promo</span>
      </FreshnessRow>,
    )
    // trailing space targets the class name; without it this matches "--pulse-freshness" in the style attr
    expect(neutral).not.toContain("pulse-fresh ")

    const dormant = renderToString(
      <FreshnessRow intensity={0} dormant>
        <span>Old promo</span>
      </FreshnessRow>,
    )
    expect(dormant).toContain("pulse-dormant")
  })
})
