import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { Continuum } from "../../src/components/continuum/Continuum"

describe("Continuum mode toggle", () => {
  test("renders a Visual/Document mode toggle", () => {
    const html = renderToString(
      <Continuum
        collection="blog_post"
        collectionLabel="Blog Post"
        fields={{ title: { type: "text" }, body: { type: "richText" } }}
        apiBase=""
        siteBase="http://s"
      />,
    )
    expect(html).toContain("cn-mode-toggle")
    expect(html).toContain("Visual")
    expect(html).toContain("Document")
  })

  test("defaults to document mode and renders the ChannelMirror there", () => {
    const html = renderToString(
      <Continuum
        collection="blog_post"
        collectionLabel="Blog Post"
        fields={{ title: { type: "text" }, body: { type: "richText" } }}
        apiBase=""
        siteBase="http://s"
      />,
    )
    // The mode is exposed on cn-root so CSS can give the Visual canvas the full width.
    expect(html).toContain('data-mode="document"')
    // In document mode the ChannelMirror live preview is rendered (hidden in visual mode).
    expect(html).toContain("cn-mirror")
  })
})
