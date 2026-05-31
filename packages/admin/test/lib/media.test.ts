import { afterEach, describe, expect, test } from "bun:test"
import { deleteMediaItem, listMediaItems, mediaDisplayUrl, replaceMediaFile, updateMediaItem, uploadMediaFile } from "../../src/lib/media"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("admin media API client", () => {
  test("lists media through the configured API base with credentials", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return Response.json({
        data: [
          {
            id: "asset-1",
            filename: "hero.jpg",
            mimetype: "image/jpeg",
            size: 1024,
            path: "/tmp/hero.jpg",
            uploadedAt: "2026-05-31T00:00:00.000Z",
          },
        ],
      })
    }) as typeof fetch

    const items = await listMediaItems("https://cms.example.test/base/")

    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe("https://cms.example.test/base/api/media")
    expect(calls[0]?.init?.credentials).toBe("include")
    expect(items[0]?.url).toBe("https://cms.example.test/base/api/media/asset-1/file")
  })

  test("uploads one file as multipart form data", async () => {
    const file = new File(["image"], "hero.jpg", { type: "image/jpeg" })
    const calls: Array<{ url: string; init?: RequestInit }> = []

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return Response.json({
        id: "asset-1",
        filename: "hero.jpg",
        mimetype: "image/jpeg",
        size: 5,
        path: "/tmp/hero.jpg",
        uploadedAt: "2026-05-31T00:00:00.000Z",
      }, { status: 201 })
    }) as typeof fetch

    const item = await uploadMediaFile("https://cms.example.test", file)

    expect(calls[0]?.url).toBe("https://cms.example.test/api/media/upload")
    expect(calls[0]?.init?.method).toBe("POST")
    expect(calls[0]?.init?.credentials).toBe("include")
    expect(calls[0]?.init?.body).toBeInstanceOf(FormData)
    expect(item.url).toBe("https://cms.example.test/api/media/asset-1/file")
  })

  test("deletes media through the API", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return Response.json({ deleted: true })
    }) as typeof fetch

    await deleteMediaItem("https://cms.example.test", "asset-1")

    expect(calls[0]?.url).toBe("https://cms.example.test/api/media/asset-1")
    expect(calls[0]?.init?.method).toBe("DELETE")
    expect(calls[0]?.init?.credentials).toBe("include")
  })

  test("updates media metadata", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return Response.json({
        id: "asset-1",
        filename: "hero.jpg",
        mimetype: "image/jpeg",
        size: 5,
        uploadedAt: "2026-05-31T00:00:00.000Z",
        alt: "Hero alt",
        title: "Hero title",
        caption: "Hero caption",
        focalX: 0.4,
        focalY: 0.6,
      })
    }) as typeof fetch

    const item = await updateMediaItem("https://cms.example.test", "asset-1", {
      alt: "Hero alt",
      title: "Hero title",
      caption: "Hero caption",
      focalX: 0.4,
      focalY: 0.6,
    })

    expect(calls[0]?.url).toBe("https://cms.example.test/api/media/asset-1")
    expect(calls[0]?.init?.method).toBe("PATCH")
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      alt: "Hero alt",
      title: "Hero title",
      caption: "Hero caption",
      focalX: 0.4,
      focalY: 0.6,
    })
    expect(item.alt).toBe("Hero alt")
  })

  test("replaces a media file as multipart form data", async () => {
    const file = new File(["replacement"], "replacement.jpg", { type: "image/jpeg" })
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return Response.json({
        id: "asset-1",
        filename: "replacement.jpg",
        mimetype: "image/jpeg",
        size: 11,
        uploadedAt: "2026-05-31T00:00:00.000Z",
        alt: "Existing alt",
      })
    }) as typeof fetch

    const item = await replaceMediaFile("https://cms.example.test", "asset-1", file)

    expect(calls[0]?.url).toBe("https://cms.example.test/api/media/asset-1/replace")
    expect(calls[0]?.init?.method).toBe("POST")
    expect(calls[0]?.init?.body).toBeInstanceOf(FormData)
    expect(item.filename).toBe("replacement.jpg")
    expect(item.alt).toBe("Existing alt")
  })

  test("uses existing URL values without rewriting them", () => {
    expect(mediaDisplayUrl("https://cdn.example.test/hero.jpg", "https://cms.example.test")).toBe("https://cdn.example.test/hero.jpg")
    expect(mediaDisplayUrl({ url: "/uploads/hero.jpg" }, "https://cms.example.test")).toBe("https://cms.example.test/uploads/hero.jpg")
  })
})
