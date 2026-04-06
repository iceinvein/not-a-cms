import { test, expect, describe } from "bun:test"
import { renderRSSFeed, portableTextToHtml, renderJSONChannel } from "../../src/runtime/channel"

describe("renderRSSFeed", () => {
  test("generates valid RSS XML", () => {
    const xml = renderRSSFeed(
      { title: "My Blog", description: "A test blog", siteUrl: "https://example.com" },
      [{
        title: "First Post",
        link: "https://example.com/first",
        description: "Hello world",
        pubDate: new Date("2026-01-01").toUTCString(),
        guid: "https://example.com/first",
      }],
    )
    expect(xml).toContain('<?xml version="1.0"')
    expect(xml).toContain("<rss")
    expect(xml).toContain("<title><![CDATA[My Blog]]></title>")
    expect(xml).toContain("<title><![CDATA[First Post]]></title>")
    expect(xml).toContain("<link>https://example.com/first</link>")
  })

  test("handles empty items", () => {
    const xml = renderRSSFeed(
      { title: "Empty", description: "No posts", siteUrl: "https://example.com" },
      [],
    )
    expect(xml).toContain("<channel>")
    expect(xml).not.toContain("<item>")
  })

  test("defaults language to en", () => {
    const xml = renderRSSFeed(
      { title: "Test", description: "Test", siteUrl: "https://example.com" },
      [],
    )
    expect(xml).toContain("<language>en</language>")
  })
})

describe("portableTextToHtml", () => {
  test("converts paragraph", () => {
    const html = portableTextToHtml([{
      type: "paragraph",
      children: [{ type: "text", value: "Hello" }],
    }])
    expect(html).toBe("<p>Hello</p>")
  })

  test("converts heading", () => {
    const html = portableTextToHtml([{
      type: "heading",
      level: 2,
      children: [{ type: "text", value: "Title" }],
    }])
    expect(html).toBe("<h2>Title</h2>")
  })

  test("converts bullet list", () => {
    const html = portableTextToHtml([{
      type: "bulletList",
      items: [
        [{ type: "paragraph", children: [{ type: "text", value: "First" }] }],
        [{ type: "paragraph", children: [{ type: "text", value: "Second" }] }],
      ],
    }])
    expect(html).toContain("<ul>")
    expect(html).toContain("<li><p>First</p></li>")
  })

  test("converts code block", () => {
    const html = portableTextToHtml([{ type: "codeBlock", code: "const x = 1" }])
    expect(html).toBe("<pre><code>const x = 1</code></pre>")
  })

  test("converts divider", () => {
    expect(portableTextToHtml([{ type: "divider" }])).toBe("<hr />")
  })
})

describe("renderJSONChannel", () => {
  test("returns pretty-printed JSON", () => {
    const blocks = [{ type: "paragraph", children: [{ type: "text", value: "Hello" }] }]
    const json = renderJSONChannel(blocks)
    expect(JSON.parse(json)).toEqual(blocks)
  })
})
