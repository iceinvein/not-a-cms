import { describe, expect, test } from "bun:test"
import { liveUrlForDocument } from "../../src/components/continuum/live-url"

const routes = [
  { collection: "blog_post", path: "/blog/:slug" },
  { collection: "page", path: "/:slug" },
]

describe("liveUrlForDocument", () => {
  // After publishing, the success toast offers "View live". The link must be the same
  // canonical public path the renderer uses, built from the site's route table, not a guess.
  test("builds the canonical public URL from the matching route", () => {
    expect(
      liveUrlForDocument({
        routes,
        collection: "blog_post",
        doc: { slug: "hello", id: "1" },
        siteBase: "http://s",
      }),
    ).toBe("http://s/blog/hello")
  })

  test("handles a top-level page route", () => {
    expect(
      liveUrlForDocument({
        routes,
        collection: "page",
        doc: { slug: "about", id: "2" },
        siteBase: "http://s",
      }),
    ).toBe("http://s/about")
  })

  // A custom slug field on the route is honored over the default "slug".
  test("uses the route's configured slug field when present", () => {
    expect(
      liveUrlForDocument({
        routes: [{ collection: "blog_post", path: "/p/:slug", slug: "permalink" }],
        collection: "blog_post",
        doc: { permalink: "custom", slug: "ignored", id: "1" },
        siteBase: "http://s",
      }),
    ).toBe("http://s/p/custom")
  })

  // No "View live" link when the collection isn't routed publicly, or routes are unknown.
  test("returns null when no route matches the collection", () => {
    expect(
      liveUrlForDocument({
        routes,
        collection: "author",
        doc: { slug: "x", id: "3" },
        siteBase: "http://s",
      }),
    ).toBeNull()
  })

  test("returns null when the route table is unavailable", () => {
    expect(
      liveUrlForDocument({
        routes: null,
        collection: "blog_post",
        doc: { slug: "x", id: "1" },
        siteBase: "http://s",
      }),
    ).toBeNull()
  })
})
