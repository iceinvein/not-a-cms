import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { TestimonialLiving } from "../../../src/components/continuum/canvas/living/TestimonialLiving"
import { expectBlockParity } from "../parity"

const full = { quote: "Great tool", name: "Dana", role: "CTO", avatar: "/a.jpg" }

describe("TestimonialLiving", () => {
  test("matches the production renderer (with avatar + role)", () => {
    expectBlockParity(
      <TestimonialLiving attrs={full} editable={false} setText={() => {}} />,
      "testimonial",
      full,
    )
  })

  test("matches the renderer with empty quote/name and no role/avatar", () => {
    const bare = { quote: "", name: "", role: "", avatar: "" }
    expectBlockParity(
      <TestimonialLiving attrs={bare} editable={false} setText={() => {}} />,
      "testimonial",
      bare,
    )
  })

  test("editable mode renders contenteditable holes", () => {
    const html = renderToString(<TestimonialLiving attrs={full} editable setText={() => {}} />)
    expect(html.toLowerCase()).toContain("contenteditable") // React 19 serializes the prop as contentEditable="true"
    expect(html).toContain("Great tool")
    expect(html).toContain('class="nac-quote-name"')
  })
})
