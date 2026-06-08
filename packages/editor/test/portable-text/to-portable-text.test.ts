import { describe, expect, test } from "bun:test"
import { toPortableText } from "../../src/portable-text/to-portable-text"

describe("toPortableText", () => {
  test("converts empty document", () => {
    const result = toPortableText({ type: "doc", content: [] })
    expect(result).toEqual([])
  })

  test("converts paragraph with plain text", () => {
    const result = toPortableText({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    })
    expect(result).toEqual([
      {
        type: "paragraph",
        children: [{ type: "text", value: "Hello world" }],
      },
    ])
  })

  test("converts paragraph with bold and italic marks", () => {
    const result = toPortableText({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Normal " },
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
            { type: "text", text: " and " },
            { type: "text", text: "italic", marks: [{ type: "italic" }] },
          ],
        },
      ],
    })
    expect(result).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "text", value: "Normal " },
          { type: "text", value: "bold", marks: ["bold"] },
          { type: "text", value: " and " },
          { type: "text", value: "italic", marks: ["italic"] },
        ],
      },
    ])
  })

  test("converts link marks with href", () => {
    const result = toPortableText({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "click here",
              marks: [{ type: "link", attrs: { href: "https://example.com", target: "_blank" } }],
            },
          ],
        },
      ],
    })
    expect(result[0].children[0].marks).toEqual([
      { type: "link", href: "https://example.com", target: "_blank" },
    ])
  })

  test("converts heading with level", () => {
    const result = toPortableText({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Title" }],
        },
      ],
    })
    expect(result).toEqual([
      {
        type: "heading",
        level: 2,
        children: [{ type: "text", value: "Title" }],
      },
    ])
  })

  test("converts blockquote", () => {
    const result = toPortableText({
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "A quote" }],
            },
          ],
        },
      ],
    })
    expect(result).toEqual([
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
  })

  test("converts bullet list", () => {
    const result = toPortableText({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "First" }] }],
            },
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Second" }] }],
            },
          ],
        },
      ],
    })
    expect(result).toEqual([
      {
        type: "bulletList",
        items: [
          [{ type: "paragraph", children: [{ type: "text", value: "First" }] }],
          [{ type: "paragraph", children: [{ type: "text", value: "Second" }] }],
        ],
      },
    ])
  })

  test("converts ordered list", () => {
    const result = toPortableText({
      type: "doc",
      content: [
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "One" }] }],
            },
          ],
        },
      ],
    })
    expect(result[0].type).toBe("orderedList")
    expect(result[0].items.length).toBe(1)
  })

  test("converts code block with language", () => {
    const result = toPortableText({
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "typescript" },
          content: [{ type: "text", text: "const x = 1" }],
        },
      ],
    })
    expect(result).toEqual([
      {
        type: "codeBlock",
        language: "typescript",
        code: "const x = 1",
      },
    ])
  })

  test("converts horizontal rule to divider", () => {
    const result = toPortableText({
      type: "doc",
      content: [{ type: "horizontalRule" }],
    })
    expect(result).toEqual([{ type: "divider" }])
  })

  test("handles document with mixed block types", () => {
    const result = toPortableText({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Title" }] },
        { type: "paragraph", content: [{ type: "text", text: "Body text" }] },
        { type: "horizontalRule" },
        { type: "paragraph", content: [{ type: "text", text: "After divider" }] },
      ],
    })
    expect(result.length).toBe(4)
    expect(result[0].type).toBe("heading")
    expect(result[1].type).toBe("paragraph")
    expect(result[2].type).toBe("divider")
    expect(result[3].type).toBe("paragraph")
  })

  test("handles empty paragraph (no content)", () => {
    const result = toPortableText({
      type: "doc",
      content: [{ type: "paragraph" }],
    })
    expect(result).toEqual([{ type: "paragraph", children: [] }])
  })
})
