import { test, expect, describe } from "bun:test"
import { parseWXR, htmlToPortableText } from "../../src/import/wordpress"

describe("WordPress import", () => {
  test("htmlToPortableText converts paragraph", () => {
    const blocks = htmlToPortableText("<p>Hello world</p>")
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe("paragraph")
    expect(blocks[0].children[0].value).toBe("Hello world")
  })

  test("htmlToPortableText converts heading", () => {
    const blocks = htmlToPortableText("<h2>My Heading</h2>")
    expect(blocks[0].type).toBe("heading")
    expect(blocks[0].level).toBe(2)
  })

  test("htmlToPortableText converts bold and italic", () => {
    const blocks = htmlToPortableText("<p><strong>bold</strong> and <em>italic</em></p>")
    expect(blocks[0].children[0].marks).toContain("bold")
    expect(blocks[0].children[2].marks).toContain("italic")
  })

  test("htmlToPortableText converts images", () => {
    const blocks = htmlToPortableText('<img src="https://example.com/img.jpg" alt="Photo" />')
    expect(blocks[0].type).toBe("image")
    expect(blocks[0].src).toBe("https://example.com/img.jpg")
  })

  test("htmlToPortableText converts lists", () => {
    const blocks = htmlToPortableText("<ul><li>Item 1</li><li>Item 2</li></ul>")
    expect(blocks[0].type).toBe("bulletList")
    expect(blocks[0].items).toHaveLength(2)
  })

  test("htmlToPortableText converts blockquote", () => {
    const blocks = htmlToPortableText("<blockquote><p>A quote</p></blockquote>")
    expect(blocks[0].type).toBe("blockquote")
  })

  test("parseWXR extracts posts from WXR", () => {
    const wxr = `<?xml version="1.0"?>
    <rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
      <channel>
        <item>
          <title>Test Post</title>
          <wp:post_name>test-post</wp:post_name>
          <wp:post_type>post</wp:post_type>
          <wp:status>publish</wp:status>
          <content:encoded><![CDATA[<p>Hello world</p>]]></content:encoded>
        </item>
      </channel>
    </rss>`
    const result = parseWXR(wxr)
    expect(result.posts).toHaveLength(1)
    expect(result.posts[0].title).toBe("Test Post")
    expect(result.posts[0].slug).toBe("test-post")
    expect(result.posts[0].status).toBe("published")
    expect(result.posts[0].body[0].type).toBe("paragraph")
  })
})
