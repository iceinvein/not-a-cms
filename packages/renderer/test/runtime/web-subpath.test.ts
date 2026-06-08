import { describe, expect, test } from "bun:test"
import { renderPortableText } from "@not-a-cms/renderer/web"

describe("@not-a-cms/renderer/web subpath", () => {
  test("renderPortableText is importable from the web subpath", () => {
    expect(
      renderPortableText([{ type: "paragraph", children: [{ type: "text", value: "x" }] }], "web"),
    ).toContain("<p>")
  })
})
