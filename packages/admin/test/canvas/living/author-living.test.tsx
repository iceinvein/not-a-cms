import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { AuthorLiving } from "../../../src/components/continuum/canvas/living/AuthorLiving"
import { expectBlockParity } from "../parity"

describe("AuthorLiving", () => {
  test("matches the production renderer (name + role)", () => {
    const full = { name: "Dana", role: "Engineer" }
    expectBlockParity(
      <AuthorLiving attrs={full} editable={false} setText={() => {}} />,
      "author",
      full,
    )
  })

  test("matches the renderer with name only (role omitted)", () => {
    const nameOnly = { name: "Dana", role: "" }
    expectBlockParity(
      <AuthorLiving attrs={nameOnly} editable={false} setText={() => {}} />,
      "author",
      nameOnly,
    )
  })

  test("editable mode renders contenteditable name/role holes", () => {
    const html = renderToString(
      <AuthorLiving attrs={{ name: "Dana", role: "Eng" }} editable setText={() => {}} />,
    )
    expect(html.toLowerCase()).toContain("contenteditable") // React 19 serializes the prop as contentEditable="true"
    expect(html).toContain("data-author-name")
    expect(html).toContain("Dana")
  })
})
