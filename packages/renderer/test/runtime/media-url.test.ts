import { describe, expect, test } from "bun:test"
import { mediaUrl } from "../../src/runtime/content-fetcher"

const API = "http://localhost:4321"

describe("mediaUrl (F-015)", () => {
  test("builds an absolute file URL from a bare media id", () => {
    expect(mediaUrl(API, "abc-123")).toBe("http://localhost:4321/api/media/abc-123/file")
  })

  test("prefixes a root-relative media path with the API base", () => {
    expect(mediaUrl(API, "/api/media/abc-123/file")).toBe("http://localhost:4321/api/media/abc-123/file")
  })

  test("passes an absolute URL through unchanged", () => {
    expect(mediaUrl(API, "https://cdn.example.com/x.png")).toBe("https://cdn.example.com/x.png")
  })

  test("resolves a populated media object via its id", () => {
    expect(mediaUrl(API, { id: "abc-123" })).toBe("http://localhost:4321/api/media/abc-123/file")
  })

  test("prefers a populated media object's url over its id", () => {
    expect(mediaUrl(API, { id: "abc-123", url: "/api/media/abc-123/file" })).toBe(
      "http://localhost:4321/api/media/abc-123/file",
    )
  })

  test("tolerates a trailing slash on the API base", () => {
    expect(mediaUrl("http://localhost:4321/", "abc-123")).toBe("http://localhost:4321/api/media/abc-123/file")
  })

  test("returns null for empty or missing values", () => {
    expect(mediaUrl(API, null)).toBeNull()
    expect(mediaUrl(API, undefined)).toBeNull()
    expect(mediaUrl(API, "")).toBeNull()
    expect(mediaUrl(API, "   ")).toBeNull()
    expect(mediaUrl(API, {})).toBeNull()
  })
})
