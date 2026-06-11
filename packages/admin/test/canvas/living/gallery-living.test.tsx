import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { GalleryLiving } from "../../../src/components/continuum/canvas/living/GalleryLiving"
import { expectBlockParity } from "../parity"

describe("GalleryLiving", () => {
  test("matches the production renderer", () => {
    const full = {
      images: [
        { id: "3", url: "/g1.jpg" },
        { id: "4", url: "/g2.jpg" },
      ],
    }
    expectBlockParity(<GalleryLiving attrs={full} editable={false} />, "gallery", full)
  })

  test("matches the renderer when empty", () => {
    expectBlockParity(<GalleryLiving attrs={{ images: [] }} editable={false} />, "gallery", {
      images: [],
    })
  })

  test("editable mode renders the gallery images", () => {
    const html = renderToString(
      <GalleryLiving attrs={{ images: [{ id: "3", url: "/g1.jpg" }] }} editable />,
    )
    expect(html).toContain("data-gallery")
    expect(html).toContain("/g1.jpg")
  })
})
