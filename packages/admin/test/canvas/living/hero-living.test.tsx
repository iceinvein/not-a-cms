// packages/admin/test/canvas/living/hero-living.test.tsx
import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { HeroLiving } from "../../../src/components/continuum/canvas/living/HeroLiving"
import { expectBlockParity } from "../parity"

const full = {
  eyebrow: "Beta",
  headline: "Ship pages fast",
  subheadline: "No forms, just the page",
  align: "left",
  backgroundImage: "",
  overlay: true,
}

describe("HeroLiving", () => {
  test("matches the production renderer (no background)", () => {
    expectBlockParity(<HeroLiving attrs={full} editable={false} setText={() => {}} />, "hero", full)
  })

  test("matches the production renderer (with background + overlay)", () => {
    const withBg = { ...full, backgroundImage: "/img/hero.jpg", overlay: true }
    expectBlockParity(
      <HeroLiving attrs={withBg} editable={false} setText={() => {}} />,
      "hero",
      withBg,
    )
  })

  test("matches the production renderer with non-default spacing", () => {
    const spacious = { ...full, spacing: "spacious" }
    expectBlockParity(
      <HeroLiving attrs={spacious} editable={false} setText={() => {}} />,
      "hero",
      spacious,
    )
  })

  test("normal spacing emits no data-spacing (default unchanged)", () => {
    const html = renderToString(
      <HeroLiving attrs={{ ...full, spacing: "normal" }} editable={false} setText={() => {}} />,
    )
    expect(html).not.toContain("data-spacing")
  })

  test("editable mode renders contenteditable holes for the text fields", () => {
    const html = renderToString(<HeroLiving attrs={full} editable setText={() => {}} />)
    expect(html.toLowerCase()).toContain("contenteditable") // React 19 serializes the prop as contentEditable="true"
    expect(html).toContain("Ship pages fast")
    expect(html).toContain('class="nac-hero-headline"')
  })
})
