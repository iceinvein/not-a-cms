import { describe, expect, test } from "bun:test"
import { fromPortableText } from "../../src/portable-text/from-portable-text"
import { toPortableText } from "../../src/portable-text/to-portable-text"

describe("fromPortableText", () => {
  test("converts empty array to empty doc", () => {
    const result = fromPortableText([])
    expect(result).toEqual({ type: "doc", content: [] })
  })

  test("converts paragraph with plain text", () => {
    const result = fromPortableText([
      {
        type: "paragraph",
        children: [{ type: "text", value: "Hello" }],
      },
    ])
    expect(result).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello" }],
        },
      ],
    })
  })

  test("converts marks back to Tiptap format", () => {
    const result = fromPortableText([
      {
        type: "paragraph",
        children: [
          { type: "text", value: "bold", marks: ["bold"] },
          { type: "text", value: "link", marks: [{ type: "link", href: "https://example.com" }] },
        ],
      },
    ])
    const content = result.content[0].content
    expect(content[0].marks).toEqual([{ type: "bold" }])
    expect(content[1].marks).toEqual([{ type: "link", attrs: { href: "https://example.com" } }])
  })

  test("converts heading with level", () => {
    const result = fromPortableText([
      {
        type: "heading",
        level: 2,
        children: [{ type: "text", value: "Title" }],
      },
    ])
    expect(result.content[0].type).toBe("heading")
    expect(result.content[0].attrs.level).toBe(2)
  })

  test("converts blockquote", () => {
    const result = fromPortableText([
      {
        type: "blockquote",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", value: "A quote" }],
          },
        ],
      },
    ])
    expect(result.content[0].type).toBe("blockquote")
    expect(result.content[0].content[0].type).toBe("paragraph")
  })

  test("converts bullet list", () => {
    const result = fromPortableText([
      {
        type: "bulletList",
        items: [
          [{ type: "paragraph", children: [{ type: "text", value: "First" }] }],
          [{ type: "paragraph", children: [{ type: "text", value: "Second" }] }],
        ],
      },
    ])
    expect(result.content[0].type).toBe("bulletList")
    expect(result.content[0].content.length).toBe(2)
    expect(result.content[0].content[0].type).toBe("listItem")
  })

  test("converts code block", () => {
    const result = fromPortableText([
      {
        type: "codeBlock",
        language: "typescript",
        code: "const x = 1",
      },
    ])
    expect(result.content[0].type).toBe("codeBlock")
    expect(result.content[0].attrs.language).toBe("typescript")
    expect(result.content[0].content[0].text).toBe("const x = 1")
  })

  test("converts divider to horizontalRule", () => {
    const result = fromPortableText([{ type: "divider" }])
    expect(result.content[0].type).toBe("horizontalRule")
  })

  test("round-trip: toPortableText(fromPortableText(pt)) preserves data", () => {
    const original = [
      {
        type: "heading",
        level: 1,
        children: [{ type: "text", value: "Hello" }],
      },
      {
        type: "paragraph",
        children: [
          { type: "text", value: "Normal " },
          { type: "text", value: "bold", marks: ["bold"] },
        ],
      },
      { type: "divider" },
      {
        type: "codeBlock",
        language: "js",
        code: "alert(1)",
      },
    ]
    const tiptap = fromPortableText(original)
    const roundTripped = toPortableText(tiptap)
    expect(roundTripped).toEqual(original)
  })
})
