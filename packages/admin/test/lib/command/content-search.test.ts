import { describe, expect, test } from "bun:test"
import { type ContentHit, searchContent } from "../../../src/lib/command/content-search"

const collections = [
  { name: "blog_post", labels: { singular: "Blog Post", plural: "Blog Posts" }, fields: {} },
  { name: "page", labels: { singular: "Page", plural: "Pages" }, fields: {} },
]

describe("searchContent", () => {
  test("empty query returns no hits and makes no requests", async () => {
    let calls = 0
    const hits = await searchContent("", collections, "", async () => {
      calls++
      return { data: [] }
    })
    expect(hits).toEqual([])
    expect(calls).toBe(0)
  })

  test("fans out across collections and flattens hits with titles + links", async () => {
    const fetcher = async (path: string) => {
      if (path.startsWith("/api/blog_post")) {
        return { data: [{ id: "p1", title: "Launch week", status: "draft" }] }
      }
      return { data: [{ id: "a1", slug: "about" }] }
    }
    const hits = await searchContent("", collections, "la", fetcher)
    const byId = Object.fromEntries(hits.map((h: ContentHit) => [h.documentId, h]))
    expect(byId["p1"]).toMatchObject({
      collection: "blog_post",
      title: "Launch week",
      href: "/content/blog_post/p1",
    })
    expect(byId["a1"].title).toBe("about")
  })

  test("a failing collection request is skipped, others still return", async () => {
    const fetcher = async (path: string) => {
      if (path.startsWith("/api/blog_post")) throw new Error("boom")
      return { data: [{ id: "a1", title: "About" }] }
    }
    const hits = await searchContent("", collections, "x", fetcher)
    expect(hits.map((h) => h.documentId)).toEqual(["a1"])
  })
})
