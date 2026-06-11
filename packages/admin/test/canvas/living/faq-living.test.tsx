import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { FaqLiving } from "../../../src/components/continuum/canvas/living/FaqLiving"
import { expectBlockParity } from "../parity"

const full = {
  heading: "FAQ",
  items: [
    { question: "Is it fast?", answer: "Yes." },
    { question: "Is it safe?", answer: "Very." },
  ],
}

describe("FaqLiving", () => {
  test("matches the production renderer", () => {
    expectBlockParity(
      <FaqLiving attrs={full} editable={false} setText={() => {}} setItems={() => {}} />,
      "faq",
      full,
    )
  })

  test("editable mode renders open details with contenteditable holes", () => {
    const html = renderToString(
      <FaqLiving attrs={full} editable setText={() => {}} setItems={() => {}} />,
    )
    expect(html.toLowerCase()).toContain("contenteditable") // React 19 serializes the prop as contentEditable="true"
    expect(html).toContain("Is it fast?")
    expect(html).toContain('class="nac-faq-q"')
    expect(html).toContain("open")
  })
})
