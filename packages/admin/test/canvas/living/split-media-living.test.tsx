import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { SplitMediaLiving } from "../../../src/components/continuum/canvas/living/SplitMediaLiving"
import { expectBlockParity } from "../parity"

const full = {
  media: "/m.jpg",
  side: "right",
  heading: "Built for teams",
  body: "Collaborate live.",
  ctaLabel: "Learn more",
  ctaUrl: "/learn",
}

describe("SplitMediaLiving", () => {
  test("matches the production renderer", () => {
    expectBlockParity(
      <SplitMediaLiving attrs={full} editable={false} setText={() => {}} />,
      "splitMedia",
      full,
    )
  })

  test("matches the renderer with no media and no cta", () => {
    const bare = { media: "", side: "left", heading: "H", body: "B", ctaLabel: "", ctaUrl: "" }
    expectBlockParity(
      <SplitMediaLiving attrs={bare} editable={false} setText={() => {}} />,
      "splitMedia",
      bare,
    )
  })

  test("editable mode renders contenteditable holes", () => {
    const html = renderToString(<SplitMediaLiving attrs={full} editable setText={() => {}} />)
    expect(html.toLowerCase()).toContain("contenteditable") // React 19 serializes the prop as contentEditable="true"
    expect(html).toContain("Built for teams")
    expect(html).toContain('class="nac-split-heading"')
  })
})
