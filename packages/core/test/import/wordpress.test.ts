import { describe, expect, test } from "bun:test"
import { defineCollection, field } from "../../src"
import { createWordPressImportPlan, htmlToPortableText, parseWXR } from "../../src/import/wordpress"

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

  test("parseWXR extracts pages, media, authors, tags, and categories", () => {
    const wxr = `<?xml version="1.0"?>
    <rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
      <channel>
        <wp:author>
          <wp:author_login>jane</wp:author_login>
          <wp:author_email>jane@example.com</wp:author_email>
          <wp:author_display_name><![CDATA[Jane Editor]]></wp:author_display_name>
        </wp:author>
        <wp:term>
          <wp:term_id>7</wp:term_id>
          <wp:term_taxonomy>category</wp:term_taxonomy>
          <wp:term_slug>news</wp:term_slug>
          <wp:term_name><![CDATA[News]]></wp:term_name>
        </wp:term>
        <wp:term>
          <wp:term_id>8</wp:term_id>
          <wp:term_taxonomy>post_tag</wp:term_taxonomy>
          <wp:term_slug>launch</wp:term_slug>
          <wp:term_name><![CDATA[Launch]]></wp:term_name>
        </wp:term>
        <item>
          <title>About</title>
          <wp:post_name>about</wp:post_name>
          <wp:post_type>page</wp:post_type>
          <wp:status>publish</wp:status>
          <content:encoded><![CDATA[<p>About us</p>]]></content:encoded>
        </item>
        <item>
          <title>Hero Image</title>
          <wp:post_name>hero-image</wp:post_name>
          <wp:post_type>attachment</wp:post_type>
          <wp:status>inherit</wp:status>
          <wp:attachment_url>https://example.com/hero.jpg</wp:attachment_url>
          <wp:post_mime_type>image/jpeg</wp:post_mime_type>
        </item>
      </channel>
    </rss>`

    const result = parseWXR(wxr)

    expect(result.pages[0].slug).toBe("about")
    expect(result.media[0].url).toBe("https://example.com/hero.jpg")
    expect(result.authors[0].displayName).toBe("Jane Editor")
    expect(result.categories[0].name).toBe("News")
    expect(result.tags[0].slug).toBe("launch")
  })

  test("createWordPressImportPlan maps parsed WXR records into configured collections", () => {
    const collections = [
      defineCollection({
        name: "blog_post",
        fields: {
          title: field.text(),
          slug: field.slug({ from: "title" }),
          body: field.richText(),
          status: field.select(["draft", "published"], { default: "draft" }),
          author: field.text(),
          tags: field.array(field.text()),
          categories: field.array(field.text()),
        },
      }),
      defineCollection({
        name: "page",
        fields: {
          title: field.text(),
          slug: field.slug({ from: "title" }),
          body: field.richText(),
          status: field.select(["draft", "published"], { default: "draft" }),
        },
      }),
      defineCollection({
        name: "media",
        fields: {
          title: field.text(),
          slug: field.slug({ from: "title" }),
          url: field.text(),
          mimeType: field.text(),
        },
      }),
      defineCollection({
        name: "author",
        fields: {
          name: field.text(),
          email: field.text(),
          slug: field.slug({ from: "name" }),
        },
      }),
      defineCollection({
        name: "tag",
        fields: {
          name: field.text(),
          slug: field.slug({ from: "name" }),
        },
      }),
      defineCollection({
        name: "category",
        fields: {
          name: field.text(),
          slug: field.slug({ from: "name" }),
        },
      }),
    ]
    const parsed = parseWXR(`<?xml version="1.0"?>
    <rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
      <channel>
        <wp:author><wp:author_login>jane</wp:author_login><wp:author_email>jane@example.com</wp:author_email><wp:author_display_name><![CDATA[Jane Editor]]></wp:author_display_name></wp:author>
        <wp:term><wp:term_taxonomy>category</wp:term_taxonomy><wp:term_slug>news</wp:term_slug><wp:term_name><![CDATA[News]]></wp:term_name></wp:term>
        <wp:term><wp:term_taxonomy>post_tag</wp:term_taxonomy><wp:term_slug>launch</wp:term_slug><wp:term_name><![CDATA[Launch]]></wp:term_name></wp:term>
        <item>
          <title>Hello</title><dc:creator><![CDATA[jane]]></dc:creator><wp:post_name>hello</wp:post_name><wp:post_type>post</wp:post_type><wp:status>publish</wp:status>
          <category domain="category" nicename="news"><![CDATA[News]]></category>
          <category domain="post_tag" nicename="launch"><![CDATA[Launch]]></category>
          <content:encoded><![CDATA[<p>Hello world</p>]]></content:encoded>
        </item>
        <item><title>About</title><wp:post_name>about</wp:post_name><wp:post_type>page</wp:post_type><wp:status>publish</wp:status><content:encoded><![CDATA[<p>About</p>]]></content:encoded></item>
        <item><title>Hero</title><wp:post_name>hero</wp:post_name><wp:post_type>attachment</wp:post_type><wp:attachment_url>https://example.com/hero.jpg</wp:attachment_url><wp:post_mime_type>image/jpeg</wp:post_mime_type></item>
      </channel>
    </rss>`)

    const plan = createWordPressImportPlan(parsed, collections)

    expect(plan.entries.map((entry) => entry.collection)).toEqual([
      "blog_post",
      "page",
      "media",
      "author",
      "tag",
      "category",
    ])
    expect(plan.entries[0].data).toMatchObject({
      title: "Hello",
      slug: "hello",
      status: "published",
      author: "Jane Editor",
      tags: ["Launch"],
      categories: ["News"],
    })
    expect(plan.counts).toEqual({ blog_post: 1, page: 1, media: 1, author: 1, tag: 1, category: 1 })
  })
})
