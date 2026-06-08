import { afterEach, describe, expect, test } from "bun:test"
import { adminApiFetch, adminTrpcUrl } from "../../src/lib/api"
import { fetchCollection, fetchCollections } from "../../src/lib/schema"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  delete import.meta.env.PUBLIC_API_BASE
})

describe("admin schema API client", () => {
  test("uses PUBLIC_API_BASE and forwards cookies when listing collections", async () => {
    import.meta.env.PUBLIC_API_BASE = "https://cms.example.test/base/"
    const calls: Array<{ url: string; init?: RequestInit }> = []

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return Response.json({ collections: [] })
    }) as typeof fetch

    await fetchCollections({ cookie: "session=abc" })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe("https://cms.example.test/base/api/_schema")
    expect(calls[0]?.init?.headers).toEqual({ cookie: "session=abc" })
  })

  test("encodes collection names when fetching a single schema", async () => {
    import.meta.env.PUBLIC_API_BASE = "https://cms.example.test"
    const calls: Array<{ url: string; init?: RequestInit }> = []

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return Response.json({
        name: "blog/posts",
        labels: { singular: "Post", plural: "Posts" },
        fields: {},
      })
    }) as typeof fetch

    await fetchCollection("blog/posts", { cookie: "session=abc" })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe("https://cms.example.test/api/_schema/blog%2Fposts")
    expect(calls[0]?.init?.headers).toEqual({ cookie: "session=abc" })
  })

  test("client API fetch joins the base URL and includes credentials", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return Response.json({ ok: true })
    }) as typeof fetch

    await adminApiFetch("https://cms.example.test/base/", "/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe("https://cms.example.test/base/api/page")
    expect(calls[0]?.init?.credentials).toBe("include")
    expect(calls[0]?.init?.method).toBe("POST")
    expect(calls[0]?.init?.headers).toEqual({ "Content-Type": "application/json" })
  })

  test("builds the admin tRPC endpoint URL without replacing REST helpers", () => {
    expect(adminTrpcUrl("https://cms.example.test/base/")).toBe(
      "https://cms.example.test/base/trpc",
    )
    expect(adminTrpcUrl("https://cms.example.test/base/trpc")).toBe(
      "https://cms.example.test/base/trpc",
    )
  })
})
