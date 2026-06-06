import { describe, expect, test } from "bun:test"
import { createContentFetcher, documentPath, resolveRouteMatch, type RouteConfig } from "../../src/runtime/content-fetcher"

describe("resolveRouteMatch", () => {
  const routes: RouteConfig[] = [
    { collection: "page", path: "/", slug: "home" },
    { collection: "blog_post", path: "/blog/:slug" },
    { collection: "page", path: "/:slug" },
  ]

  test("matches homepage route with configured slug", () => {
    expect(resolveRouteMatch("/", routes)).toEqual({
      collection: "page",
      params: {},
      slug: "home",
      path: "/",
    })
  })

  test("matches dynamic collection route and extracts slug", () => {
    expect(resolveRouteMatch("/blog/hello-world", routes)).toEqual({
      collection: "blog_post",
      params: { slug: "hello-world" },
      slug: "hello-world",
      path: "/blog/:slug",
    })
  })

  test("returns null for unknown paths", () => {
    expect(resolveRouteMatch("/blog/hello-world/comments", routes)).toBeNull()
  })
})

describe("documentPath", () => {
  const routes: RouteConfig[] = [
    { collection: "page", path: "/", slug: "home" },
    { collection: "blog_post", path: "/blog/:slug" },
    { collection: "page", path: "/:slug" },
  ]

  test("maps the home page to /", () => {
    expect(documentPath("page", { slug: "home" }, routes)).toBe("/")
  })

  test("maps a regular page to /:slug", () => {
    expect(documentPath("page", { slug: "about" }, routes)).toBe("/about")
  })

  test("maps a blog post under /blog/:slug", () => {
    expect(documentPath("blog_post", { slug: "hello-world" }, routes)).toBe("/blog/hello-world")
  })

  test("returns null when no route exists for the collection", () => {
    expect(documentPath("author", { slug: "jane" }, routes)).toBeNull()
  })

  test("returns null when a variable route has no slug to fill", () => {
    expect(documentPath("blog_post", { slug: "" }, routes)).toBeNull()
  })
})

describe("createContentFetcher route resolution", () => {
  test("resolves a public path by fetching a published document", async () => {
    const requestedUrls: string[] = []
    const fetcher = createContentFetcher({
      apiBase: "https://api.example.test",
      routes: [{ collection: "blog_post", path: "/blog/:slug" }],
      fetch: async (url) => {
        requestedUrls.push(String(url))
        return Response.json({
          data: [{ id: "post-1", title: "Hello", slug: "hello", status: "published" }],
        })
      },
    })

    const resolved = await fetcher.resolvePath("/blog/hello")

    expect(resolved?.collection).toBe("blog_post")
    expect(resolved?.document.title).toBe("Hello")
    expect(requestedUrls[0]).toContain("/api/blog_post?")
    expect(requestedUrls[0]).toContain("where%5Bslug%5D=hello")
    expect(requestedUrls[0]).toContain("where%5Bstatus%5D=published")
  })

  test("does not return draft documents for public paths", async () => {
    const fetcher = createContentFetcher({
      apiBase: "https://api.example.test",
      routes: [{ collection: "page", path: "/:slug" }],
      fetch: async () => Response.json({
        data: [{ id: "draft-page", title: "Draft", slug: "draft", status: "draft" }],
      }),
    })

    await expect(fetcher.resolvePath("/draft")).resolves.toBeNull()
  })
})
