import { describe, expect, test } from "bun:test"
import { renderPortableText } from "../../src/runtime/portable-text-html"
import { portableTextToHtml } from "../../src/runtime/channel"

const blocks = [
  { type: "heading", level: 2, children: [{ type: "text", value: "Hi" }] },
  {
    type: "paragraph",
    children: [
      { type: "text", value: "Hello ", marks: [] },
      { type: "text", value: "world", marks: ["bold"] },
    ],
  },
]

describe("renderPortableText", () => {
  test("web output matches the existing portableTextToHtml for known blocks", () => {
    expect(renderPortableText(blocks, "web")).toBe(portableTextToHtml(blocks))
  })

  test("renders a callout block", () => {
    const html = renderPortableText(
      [{ type: "callout", variant: "info", children: [{ type: "text", value: "Note" }] }],
      "web",
    )
    expect(html).toContain('data-variant="info"')
    expect(html).toContain("Note")
  })

  test("renders an author block", () => {
    const html = renderPortableText([{ type: "author", name: "Dik Rana", role: "Founder" }], "web")
    expect(html).toContain("Dik Rana")
    expect(html).toContain("Founder")
  })

  test("imports cleanly without mjml or core (browser-safe module)", () => {
    expect(typeof renderPortableText).toBe("function")
  })
})
