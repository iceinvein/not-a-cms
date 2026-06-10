import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { PricingCardsLiving } from "../../../src/components/continuum/canvas/living/PricingCardsLiving"
import { expectBlockParity } from "../parity"

const full = {
  heading: "Plans",
  tiers: [
    { name: "Pro", price: "$29", period: "/mo", features: ["A", "B"], ctaLabel: "Get Pro", ctaUrl: "/buy", highlighted: true },
    { name: "Free", price: "$0", period: "", features: ["X"], ctaLabel: "", ctaUrl: "", highlighted: false },
  ],
}

describe("PricingCardsLiving", () => {
  test("matches the production renderer", () => {
    expectBlockParity(
      <PricingCardsLiving attrs={full} editable={false} setText={() => {}} setTiers={() => {}} />,
      "pricingCards",
      full,
    )
  })

  test("editable mode renders contenteditable holes for name and features", () => {
    const html = renderToString(<PricingCardsLiving attrs={full} editable setText={() => {}} setTiers={() => {}} />)
    expect(html.toLowerCase()).toContain("contenteditable") // React 19 serializes the prop as contentEditable="true"
    expect(html).toContain("Pro")
    expect(html).toContain('class="nac-tier-name"')
    expect(html).toContain('class="nac-tier-features"')
  })
})
