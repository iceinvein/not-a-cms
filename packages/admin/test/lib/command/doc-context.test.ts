import { describe, expect, test } from "bun:test"
import { parseDocContext } from "../../../src/lib/command/doc-context"

describe("parseDocContext", () => {
  test("edit route yields collection + documentId", () => {
    expect(parseDocContext("/content/blog_post/abc123")).toEqual({
      collection: "blog_post",
      documentId: "abc123",
    })
  })

  test("new route has collection, no documentId", () => {
    expect(parseDocContext("/content/blog_post/new")).toEqual({ collection: "blog_post" })
  })

  test("list route has collection only", () => {
    expect(parseDocContext("/content/blog_post")).toEqual({ collection: "blog_post" })
  })

  test("non-content route is empty", () => {
    expect(parseDocContext("/media")).toEqual({})
  })

  test("trailing slash tolerated", () => {
    expect(parseDocContext("/content/blog_post/abc123/")).toEqual({
      collection: "blog_post",
      documentId: "abc123",
    })
  })
})
