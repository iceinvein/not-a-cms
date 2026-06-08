import { describe, expect, test } from "bun:test"
import {
  buildNav,
  createContentFetcher,
  DEFAULT_ROUTES,
  documentPath,
  mergeRoutes,
  type RouteConfig,
  resolveRouteMatch,
} from "../../src/runtime/content-fetcher"

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

describe("buildNav", () => {
  test("links every non-home page and appends a Blog link", () => {
    const nav = buildNav([
      { title: "Home", slug: "home" },
      { title: "About", slug: "about" },
      { title: "Pricing", slug: "pricing" },
    ])
    expect(nav).toEqual([
      { label: "About", href: "/about" },
      { label: "Pricing", href: "/pricing" },
      { label: "Blog", href: "/blog" },
    ])
  })

  test("returns just the Blog link when there are no other pages", () => {
    expect(buildNav([{ title: "Home", slug: "home" }])).toEqual([{ label: "Blog", href: "/blog" }])
  })

  test("skips pages without a slug", () => {
    const nav = buildNav([
      { title: "Draftish", slug: "" },
      { title: "Docs", slug: "docs" },
    ])
    expect(nav).toEqual([
      { label: "Docs", href: "/docs" },
      { label: "Blog", href: "/blog" },
    ])
  })

  test("can omit the Blog link", () => {
    expect(buildNav([{ title: "About", slug: "about" }], { includeBlog: false })).toEqual([
      { label: "About", href: "/about" },
    ])
  })
})

describe("mergeRoutes", () => {
  test("returns DEFAULT_ROUTES when called with null", () => {
    expect(mergeRoutes(null)).toEqual(DEFAULT_ROUTES)
  })

  test("returns DEFAULT_ROUTES when called with undefined", () => {
    expect(mergeRoutes(undefined)).toEqual(DEFAULT_ROUTES)
  })

  test("places config routes before defaults", () => {
    const config = [{ collection: "project", path: "/work/:slug" }]
    const merged = mergeRoutes(config)
    expect(merged[0]).toEqual({ collection: "project", path: "/work/:slug" })
    expect(merged.slice(1)).toEqual(DEFAULT_ROUTES)
  })

  test("merged routes allow resolving a custom collection path", () => {
    const merged = mergeRoutes([{ collection: "project", path: "/work/:slug" }])
    const match = resolveRouteMatch("/work/my-project", merged)
    expect(match?.collection).toBe("project")
    expect(match?.slug).toBe("my-project")
  })

  test("default routes still work after merging", () => {
    const merged = mergeRoutes([{ collection: "project", path: "/work/:slug" }])
    const match = resolveRouteMatch("/blog/hello", merged)
    expect(match?.collection).toBe("blog_post")
    expect(match?.slug).toBe("hello")
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
      fetch: async () =>
        Response.json({
          data: [{ id: "draft-page", title: "Draft", slug: "draft", status: "draft" }],
        }),
    })

    await expect(fetcher.resolvePath("/draft")).resolves.toBeNull()
  })
})
