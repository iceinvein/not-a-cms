import { describe, expect, test } from "bun:test"
import { renderPortableText } from "../../src/runtime/portable-text-html"
import { portableTextToHtml } from "../../src/runtime/channel"
import type { RouteConfig } from "../../src/runtime/content-fetcher"

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

  test("gallery renders images and carries data-media-id when present", () => {
    const html = renderPortableText([{ type: "gallery", images: [{ id: "m1", url: "/api/media/m1/file" }] }], "web")
    expect(html).toContain("/api/media/m1/file")
    expect(html).toContain('data-media-id="m1"')
  })

  test("imports cleanly without mjml or core (browser-safe module)", () => {
    expect(typeof renderPortableText).toBe("function")
  })
})

describe("collectionList route resolution", () => {
  const projectEntry = { id: "p1", title: "Branding Work", slug: "branding-work", status: "published" }

  test("links to # when no route is configured for the collection", () => {
    const block = { type: "collectionList", collection: "project", layout: "grid" }
    const html = renderPortableText([block], "web", { collectionData: { 0: [projectEntry] } })
    expect(html).toContain('href="#"')
  })

  test("links to /work/:slug when a project route is configured", () => {
    const routes: RouteConfig[] = [
      { collection: "project", path: "/work/:slug" },
      { collection: "page", path: "/", slug: "home" },
      { collection: "blog_post", path: "/blog/:slug" },
      { collection: "page", path: "/:slug" },
    ]
    const block = { type: "collectionList", collection: "project", layout: "grid" }
    const html = renderPortableText([block], "web", { collectionData: { 0: [projectEntry] }, routes })
    expect(html).toContain('href="/work/branding-work"')
    expect(html).not.toContain('href="#"')
  })

  test("blog_post collectionList links use default /blog/:slug route when no custom routes given", () => {
    const postEntry = { id: "b1", title: "Hello World", slug: "hello-world", status: "published" }
    const block = { type: "collectionList", collection: "blog_post", layout: "grid" }
    const html = renderPortableText([block], "web", { collectionData: { 0: [postEntry] } })
    expect(html).toContain('href="/blog/hello-world"')
  })
})
