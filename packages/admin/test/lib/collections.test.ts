import { describe, expect, test } from "bun:test"
import {
  listCollectionSettings,
  saveCollectionSettings,
  type CollectionSettingsInput,
} from "../../src/lib/collections"

describe("admin collection settings API client", () => {
  test("lists collection settings with credentials", async () => {
    const originalFetch = globalThis.fetch
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      return Response.json({
        data: [{
          name: "blog_post",
          labels: { singular: "Blog Post", plural: "Blog Posts" },
          fields: { title: { type: "text" } },
          settings: { previewPath: "/blog/:slug" },
        }],
        roles: [{ key: "admin", label: "Admin" }],
      })
    }) as typeof fetch

    try {
      const result = await listCollectionSettings("https://cms.example.test")

      expect(calls[0].url).toBe("https://cms.example.test/api/_collection-settings")
      expect(calls[0].init?.credentials).toBe("include")
      expect(result.data[0].settings.previewPath).toBe("/blog/:slug")
      expect(result.roles[0].key).toBe("admin")
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test("saves collection settings", async () => {
    const originalFetch = globalThis.fetch
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      return Response.json({
        name: "blog_post",
        settings: { access: { read: ["viewer"] } },
      })
    }) as typeof fetch

    try {
      const input: CollectionSettingsInput = {
        access: { read: ["viewer"] },
        previewPath: "/blog/:slug",
      }
      const result = await saveCollectionSettings("https://cms.example.test", "blog_post", input)

      expect(calls[0].url).toBe("https://cms.example.test/api/_collection-settings/blog_post")
      expect(calls[0].init?.method).toBe("PUT")
      expect(calls[0].init?.credentials).toBe("include")
      expect(JSON.parse(String(calls[0].init?.body))).toEqual(input)
      expect(result.settings.access?.read).toEqual(["viewer"])
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
