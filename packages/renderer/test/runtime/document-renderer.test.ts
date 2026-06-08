import { describe, expect, test } from "bun:test"
import { renderDocumentContent } from "../../src/runtime/document-renderer"

const apiBase = "http://api"

describe("renderDocumentContent (async)", () => {
  test("renders a plain document with no collectionList blocks", async () => {
    const doc = {
      id: "1",
      body: JSON.stringify([{ type: "paragraph", children: [{ type: "text", value: "Hello" }] }]),
    }
    const result = await renderDocumentContent(doc, { apiBase })
    expect(result.html).toContain("<p>Hello</p>")
    expect(result.leadsWithHero).toBe(false)
  })

  test("leadsWithHero is true when first block is a hero", async () => {
    const doc = {
      id: "2",
      body: JSON.stringify([{ type: "hero", headline: "Big" }]),
    }
    const result = await renderDocumentContent(doc, { apiBase })
    expect(result.leadsWithHero).toBe(true)
    expect(result.html).toContain("nac-hero")
  })

  test("resolves collectionList data via injected fetch and renders a card", async () => {
    const stubFetch = async (url: string | URL | Request): Promise<Response> => {
      const urlStr = String(url)
      if (urlStr.includes("/api/blog_post")) {
        return new Response(
          JSON.stringify({
            data: [{ id: "p1", title: "Fetched Post", slug: "fetched-post", status: "published" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }
      return new Response("not found", { status: 404 })
    }

    const doc = {
      id: "3",
      body: JSON.stringify([
        {
          type: "collectionList",
          collection: "blog_post",
          limit: 3,
          filterTag: "",
          layout: "grid",
          showCover: false,
          showExcerpt: false,
          showDate: false,
          heading: "",
        },
      ]),
    }

    const result = await renderDocumentContent(doc, { apiBase, fetch: stubFetch as typeof fetch })
    expect(result.html).toContain("nac-collection-block")
    expect(result.html).toContain("Fetched Post")
    expect(result.html).toContain('href="/blog/fetched-post"')
  })

  test("a failing fetch leaves the block empty without throwing", async () => {
    const throwingFetch = async (): Promise<Response> => {
      throw new Error("Network error")
    }

    const doc = {
      id: "4",
      body: JSON.stringify([
        {
          type: "collectionList",
          collection: "blog_post",
          limit: 3,
          filterTag: "",
          layout: "grid",
          showCover: false,
          showExcerpt: false,
          showDate: false,
          heading: "Posts",
        },
      ]),
    }

    const result = await renderDocumentContent(doc, {
      apiBase,
      fetch: throwingFetch as typeof fetch,
    })
    expect(result.html).toContain("nac-collection-block")
    expect(result.html).toContain("Posts")
    expect(result.html).not.toContain("nac-collection-card")
  })

  test("filterTag filters results to matching entries", async () => {
    const stubFetch = async (url: string | URL | Request): Promise<Response> => {
      const urlStr = String(url)
      if (urlStr.includes("/api/blog_post")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "p1",
                title: "Tagged",
                slug: "tagged",
                status: "published",
                tags: ["featured"],
              },
              { id: "p2", title: "Untagged", slug: "untagged", status: "published", tags: [] },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }
      return new Response("not found", { status: 404 })
    }

    const doc = {
      id: "5",
      body: JSON.stringify([
        {
          type: "collectionList",
          collection: "blog_post",
          limit: 10,
          filterTag: "featured",
          layout: "grid",
          showCover: false,
          showExcerpt: false,
          showDate: false,
          heading: "",
        },
      ]),
    }

    const result = await renderDocumentContent(doc, { apiBase, fetch: stubFetch as typeof fetch })
    expect(result.html).toContain("Tagged")
    expect(result.html).not.toContain("Untagged")
  })

  test("returns empty html with leadsWithHero false when document has no body", async () => {
    const doc = { id: "6" }
    const result = await renderDocumentContent(doc, { apiBase })
    expect(result.html).toBe("")
    expect(result.leadsWithHero).toBe(false)
  })

  test("returns error html on JSON parse failure", async () => {
    const doc = { id: "7", body: "not-json{{{" }
    const result = await renderDocumentContent(doc, { apiBase })
    expect(result.html).toContain("Error rendering content.")
    expect(result.leadsWithHero).toBe(false)
  })

  test("non-collectionList blocks are unaffected by the pre-pass", async () => {
    const doc = {
      id: "8",
      body: JSON.stringify([
        { type: "hero", headline: "Hello" },
        { type: "paragraph", children: [{ type: "text", value: "World" }] },
      ]),
    }
    const result = await renderDocumentContent(doc, { apiBase })
    expect(result.html).toContain("nac-hero")
    expect(result.html).toContain("<p>World</p>")
  })
})
