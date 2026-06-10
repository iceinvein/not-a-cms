import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { ImageLiving } from "../../../src/components/continuum/canvas/living/ImageLiving"
import { expectBlockParity } from "../parity"

describe("ImageLiving", () => {
  test("matches the production renderer (url + mediaId + alt)", () => {
    const full = { url: "/p.jpg", mediaId: "9", alt: "Team photo" }
    expectBlockParity(<ImageLiving attrs={full} editable={false} />, "image", full)
  })

  test("matches the renderer with an empty image (src '#', no media id)", () => {
    const empty = { url: "", mediaId: "", alt: "" }
    expectBlockParity(<ImageLiving attrs={empty} editable={false} />, "image", empty)
  })

  test("editable mode with no url shows a pick affordance", () => {
    const html = renderToString(<ImageLiving attrs={{ url: "", mediaId: "", alt: "" }} editable />)
    expect(html).toContain("cn-image-empty")
  })
})
