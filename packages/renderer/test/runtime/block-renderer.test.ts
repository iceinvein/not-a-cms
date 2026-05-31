import { test, expect, describe } from "bun:test"
import { resolveBlockComponent, renderTextChildren } from "../../src/runtime/block-renderer"

describe("resolveBlockComponent", () => {
  test("resolves standard block types", () => {
    expect(resolveBlockComponent({ type: "paragraph" })).toBe("Paragraph")
    expect(resolveBlockComponent({ type: "heading" })).toBe("Heading")
    expect(resolveBlockComponent({ type: "codeBlock" })).toBe("CodeBlock")
    expect(resolveBlockComponent({ type: "divider" })).toBe("Divider")
    expect(resolveBlockComponent({ type: "callout" })).toBe("Callout")
  })

  test("returns null for unknown block types", () => {
    expect(resolveBlockComponent({ type: "unknown-block" })).toBeNull()
  })

  test("custom map overrides defaults", () => {
    expect(resolveBlockComponent({ type: "paragraph" }, { paragraph: "CustomParagraph" })).toBe("CustomParagraph")
  })

  test("custom map extends defaults", () => {
    expect(resolveBlockComponent({ type: "pricing-table" }, { "pricing-table": "PricingTable" })).toBe("PricingTable")
  })
})

describe("renderTextChildren", () => {
  test("renders plain text", () => {
    expect(renderTextChildren([{ type: "text", value: "Hello world" }])).toBe("Hello world")
  })

  test("renders bold mark", () => {
    expect(renderTextChildren([{ type: "text", value: "bold", marks: ["bold"] }])).toBe("<strong>bold</strong>")
  })

  test("renders italic mark", () => {
    expect(renderTextChildren([{ type: "text", value: "italic", marks: ["italic"] }])).toBe("<em>italic</em>")
  })

  test("renders code mark", () => {
    expect(renderTextChildren([{ type: "text", value: "code", marks: ["code"] }])).toBe("<code>code</code>")
  })

  test("renders link mark", () => {
    const result = renderTextChildren([{
      type: "text",
      value: "click",
      marks: [{ type: "link", href: "https://example.com" }],
    }])
    expect(result).toBe('<a href="https://example.com">click</a>')
  })

  test("renders multiple marks", () => {
    const result = renderTextChildren([{
      type: "text",
      value: "bold italic",
      marks: ["bold", "italic"],
    }])
    expect(result).toBe("<em><strong>bold italic</strong></em>")
  })

  test("renders multiple text nodes", () => {
    const result = renderTextChildren([
      { type: "text", value: "Hello " },
      { type: "text", value: "world", marks: ["bold"] },
    ])
    expect(result).toBe("Hello <strong>world</strong>")
  })

  test("escapes HTML in text", () => {
    expect(renderTextChildren([{ type: "text", value: "<script>alert(1)</script>" }]))
      .toBe("&lt;script&gt;alert(1)&lt;/script&gt;")
  })

  test("escapes HTML in link href", () => {
    const result = renderTextChildren([{
      type: "text",
      value: "link",
      marks: [{ type: "link", href: 'https://example.com/"quoted' }],
    }])
    expect(result).toContain("&quot;")
  })

  test("replaces unsafe link protocols", () => {
    const result = renderTextChildren([{
      type: "text",
      value: "link",
      marks: [{ type: "link", href: "javascript:alert(1)" }],
    }])
    expect(result).toBe('<a href="#">link</a>')
  })
})
