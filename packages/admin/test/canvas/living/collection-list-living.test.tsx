import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { CollectionListLiving } from "../../../src/components/continuum/canvas/living/CollectionListLiving"
import { expectBlockParity } from "../parity"

const full = {
  collection: "blog_post",
  limit: 3,
  filterTag: "",
  layout: "cards",
  showCover: true,
  showExcerpt: true,
  showDate: true,
  heading: "From the blog",
}

describe("CollectionListLiving", () => {
  test("matches the production renderer (shell, no live entries)", () => {
    expectBlockParity(
      <CollectionListLiving attrs={full} editable={false} setText={() => {}} />,
      "collectionList",
      full,
    )
  })

  test("editable mode renders the heading hole", () => {
    const html = renderToString(<CollectionListLiving attrs={full} editable setText={() => {}} />)
    expect(html.toLowerCase()).toContain("contenteditable") // React 19 serializes the prop as contentEditable="true"
    expect(html).toContain("From the blog")
    expect(html).toContain('data-layout="cards"')
  })
})
