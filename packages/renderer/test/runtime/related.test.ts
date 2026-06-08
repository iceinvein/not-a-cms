import { describe, expect, test } from "bun:test"
import { relatedPosts } from "../../src/runtime/related"

const post = (overrides: Record<string, unknown> = {}) => ({
  id: "p1",
  title: "Post One",
  tags: ["typescript", "bun"],
  created_at: "2025-01-10T00:00:00Z",
  status: "published",
  ...overrides,
})

describe("relatedPosts", () => {
  test("orders by shared-tag count descending", () => {
    const current = post({ id: "current", tags: ["typescript", "bun"] })
    const candidates = [
      post({ id: "a", tags: ["rust"], created_at: "2025-03-01T00:00:00Z" }), // 0 shared
      post({ id: "b", tags: ["typescript"], created_at: "2025-02-01T00:00:00Z" }), // 1 shared
      post({ id: "c", tags: ["typescript", "bun"], created_at: "2025-01-01T00:00:00Z" }), // 2 shared
    ]
    const result = relatedPosts(current, candidates, 3)
    expect(result.map((p) => p.id)).toEqual(["c", "b", "a"])
  })

  test("breaks ties by recency descending", () => {
    const current = post({ id: "current", tags: ["typescript"] })
    const candidates = [
      post({ id: "older", tags: ["typescript"], created_at: "2025-01-01T00:00:00Z" }),
      post({ id: "newer", tags: ["typescript"], created_at: "2025-06-01T00:00:00Z" }),
    ]
    const result = relatedPosts(current, candidates, 2)
    expect(result.map((p) => p.id)).toEqual(["newer", "older"])
  })

  test("breaks ties using publishedAt when present", () => {
    const current = post({ id: "current", tags: ["typescript"] })
    const candidates = [
      post({
        id: "a",
        tags: ["typescript"],
        created_at: "2025-01-01T00:00:00Z",
        publishedAt: "2025-03-01T00:00:00Z",
      }),
      post({
        id: "b",
        tags: ["typescript"],
        created_at: "2025-06-01T00:00:00Z",
        publishedAt: "2025-02-01T00:00:00Z",
      }),
    ]
    // publishedAt takes precedence over created_at for date sort
    const result = relatedPosts(current, candidates, 2)
    expect(result.map((p) => p.id)).toEqual(["a", "b"])
  })

  test("excludes the current post by id", () => {
    const current = post({ id: "self", tags: ["typescript"] })
    const candidates = [
      post({ id: "self", tags: ["typescript"] }),
      post({ id: "other", tags: ["typescript"] }),
    ]
    const result = relatedPosts(current, candidates, 5)
    expect(result.map((p) => p.id)).not.toContain("self")
    expect(result).toHaveLength(1)
  })

  test("respects the limit", () => {
    const current = post({ id: "current", tags: ["typescript"] })
    const candidates = Array.from({ length: 10 }, (_, i) =>
      post({ id: `p${i}`, tags: ["typescript"] }),
    )
    expect(relatedPosts(current, candidates, 3)).toHaveLength(3)
  })

  test("recency fallback when no shared tags", () => {
    const current = post({ id: "current", tags: ["haskell"] })
    const candidates = [
      post({ id: "oldest", tags: ["rust"], created_at: "2025-01-01T00:00:00Z" }),
      post({ id: "newest", tags: ["go"], created_at: "2025-12-01T00:00:00Z" }),
      post({ id: "mid", tags: ["c"], created_at: "2025-06-01T00:00:00Z" }),
    ]
    const result = relatedPosts(current, candidates, 3)
    expect(result.map((p) => p.id)).toEqual(["newest", "mid", "oldest"])
  })

  test("safe with missing tags (undefined)", () => {
    const current = post({ id: "current", tags: undefined })
    const candidates = [post({ id: "a", tags: ["typescript"] }), post({ id: "b", tags: undefined })]
    // no crashes; recency order
    expect(() => relatedPosts(current, candidates, 3)).not.toThrow()
  })

  test("safe with non-array tags (string)", () => {
    const current = post({ id: "current", tags: "typescript" })
    const candidates = [post({ id: "a", tags: "typescript" })]
    // non-array tags are treated as empty; recency fallback applies
    expect(() => relatedPosts(current, candidates, 3)).not.toThrow()
    const result = relatedPosts(current, candidates, 3)
    expect(result).toHaveLength(1)
  })

  test("safe with null tags", () => {
    const current = post({ id: "current", tags: null })
    const candidates = [post({ id: "a", tags: null })]
    expect(() => relatedPosts(current, candidates, 3)).not.toThrow()
  })

  test("returns empty array when no candidates", () => {
    const current = post({ id: "current", tags: ["typescript"] })
    expect(relatedPosts(current, [], 3)).toEqual([])
  })

  test("does not exceed available candidates", () => {
    const current = post({ id: "current", tags: ["typescript"] })
    const candidates = [post({ id: "a", tags: ["typescript"] })]
    expect(relatedPosts(current, candidates, 5)).toHaveLength(1)
  })
})
