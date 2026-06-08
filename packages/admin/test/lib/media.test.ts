import { afterEach, describe, expect, test } from "bun:test"
import {
  bulkDeleteMediaItems,
  bulkUpdateMediaTags,
  createMediaFolder,
  deleteMediaFolder,
  deleteMediaItem,
  deleteMediaTag,
  getMediaContext,
  listMediaFolders,
  listMediaItems,
  listMediaTags,
  mediaDisplayUrl,
  mergeMediaTag,
  moveMediaAssets,
  moveMediaFolder,
  normalizeTagInput,
  renameMediaFolder,
  renameMediaTag,
  reorderMediaFolder,
  replaceMediaFile,
  setMediaFolderColor,
  setMediaFolderIcon,
  setMediaFolderRoles,
  setMediaTagColor,
  setMediaTagDescription,
  setMediaTagGroup,
  updateMediaItem,
  uploadMediaFile,
} from "../../src/lib/media"

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
      return Response.json(
        {
          id: "asset-1",
          filename: "hero.jpg",
          mimetype: "image/jpeg",
          size: 5,
          path: "/tmp/hero.jpg",
          uploadedAt: "2026-05-31T00:00:00.000Z",
        },
        { status: 201 },
      )
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

  test("bulkDeleteMediaItems posts ids and returns deleted ids", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return Response.json({ deleted: ["a", "b"] })
    }) as typeof fetch

    const deleted = await bulkDeleteMediaItems("https://cms.example.test", ["a", "b"])

    expect(calls[0]?.url).toBe("https://cms.example.test/api/media/delete")
    expect(calls[0]?.init?.method).toBe("POST")
    expect(calls[0]?.init?.credentials).toBe("include")
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ ids: ["a", "b"] })
    expect(deleted).toEqual(["a", "b"])
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

  test("normalizeTagInput mirrors the server per-tag rules", () => {
    expect(normalizeTagInput("  #Hero ")).toBe("hero")
    expect(normalizeTagInput("Summer Sale")).toBe("summer-sale")
    expect(normalizeTagInput("###")).toBe("")
    expect(normalizeTagInput("a".repeat(40))).toBe("a".repeat(25))
  })

  test("updateMediaItem forwards tags in the PATCH body", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return Response.json({
        id: "asset-1",
        filename: "hero.jpg",
        mimetype: "image/jpeg",
        size: 5,
        uploadedAt: "2026-05-31T00:00:00.000Z",
        tags: ["hero"],
      })
    }) as typeof fetch

    const item = await updateMediaItem("https://cms.example.test", "asset-1", { tags: ["hero"] })

    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ tags: ["hero"] })
    expect(item.tags).toEqual(["hero"])
  })

  test("bulkUpdateMediaTags posts ids/add/remove and maps records", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return Response.json({
        data: [
          {
            id: "a",
            filename: "a.jpg",
            mimetype: "image/jpeg",
            size: 1,
            uploadedAt: "",
            tags: ["campaign"],
          },
        ],
      })
    }) as typeof fetch

    const items = await bulkUpdateMediaTags("https://cms.example.test", {
      ids: ["a"],
      add: ["campaign"],
    })

    expect(calls[0]?.url).toBe("https://cms.example.test/api/media/tags")
    expect(calls[0]?.init?.method).toBe("POST")
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ ids: ["a"], add: ["campaign"] })
    expect(items[0]?.tags).toEqual(["campaign"])
    expect(items[0]?.url).toBe("https://cms.example.test/api/media/a/file")
  })

  test("listMediaTags GETs the registry", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return Response.json({ data: [{ name: "hero", color: "#c9956b", count: 2 }] })
    }) as typeof fetch

    const tags = await listMediaTags("https://cms.example.test")

    expect(calls[0]?.url).toBe("https://cms.example.test/api/media/tags")
    expect(tags[0]).toEqual({ name: "hero", color: "#c9956b", count: 2 })
  })

  test("renameMediaTag/setMediaTagColor PATCH; deleteMediaTag DELETEs", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return Response.json({ name: "x", color: "#abcdef", count: 1 })
    }) as typeof fetch

    await renameMediaTag("https://cms.example.test", "old", "new")
    await setMediaTagColor("https://cms.example.test", "x", "#abcdef")
    await deleteMediaTag("https://cms.example.test", "x")

    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ newName: "new" })
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({ color: "#abcdef" })
    expect(calls[2]?.init?.method).toBe("DELETE")
    expect(calls[0]?.url).toBe("https://cms.example.test/api/media/tags/old")
  })

  test("folder client functions hit the right routes", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      if (String(url).endsWith("/api/media/folders"))
        return Response.json({ data: [{ id: "f1", name: "Brand", parentId: null }] })
      if (String(url).endsWith("/api/media/move")) {
        return Response.json({
          data: [
            {
              id: "a",
              filename: "a.jpg",
              mimetype: "image/jpeg",
              size: 1,
              uploadedAt: "",
              folderId: "f1",
            },
          ],
        })
      }
      if (init?.method === "DELETE") return Response.json({ reassigned: 1, reparented: 0 })
      return Response.json({ id: "f1", name: "Brand", parentId: null })
    }) as typeof fetch

    const folders = await listMediaFolders("https://cms.example.test")
    await createMediaFolder("https://cms.example.test", "Brand", null)
    await renameMediaFolder("https://cms.example.test", "f1", "Marks")
    await moveMediaFolder("https://cms.example.test", "f1", "f2")
    await deleteMediaFolder("https://cms.example.test", "f1")
    const moved = await moveMediaAssets("https://cms.example.test", ["a"], "f1")

    expect(folders[0]).toEqual({ id: "f1", name: "Brand", parentId: null })
    expect(calls[0]?.url).toBe("https://cms.example.test/api/media/folders")
    expect(calls[1]?.url).toBe("https://cms.example.test/api/media/folders")
    expect(calls[1]?.init?.method).toBe("POST")
    expect(JSON.parse(String(calls[2]?.init?.body))).toEqual({ name: "Marks" })
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({ parentId: "f2" })
    expect(calls[4]?.init?.method).toBe("DELETE")
    expect(calls[5]?.url).toBe("https://cms.example.test/api/media/move")
    expect(moved[0]?.folderId).toBe("f1")
  })

  test("tag description/group/merge client fns hit the right routes", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return Response.json({ merged: 1, name: "x", color: "#abcdef", count: 1 })
    }) as typeof fetch

    await setMediaTagDescription("https://cms.example.test", "x", "desc")
    await setMediaTagGroup("https://cms.example.test", "x", "grp")
    await mergeMediaTag("https://cms.example.test", "src", "dst")

    expect(calls[0]?.url).toBe("https://cms.example.test/api/media/tags/x")
    expect(calls[0]?.init?.method).toBe("PATCH")
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ description: "desc" })
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({ group: "grp" })
    expect(calls[2]?.url).toBe("https://cms.example.test/api/media/tags/merge")
    expect(calls[2]?.init?.method).toBe("POST")
    expect(JSON.parse(String(calls[2]?.init?.body))).toEqual({ source: "src", target: "dst" })
  })

  test("setMediaFolderRoles PATCHes roles; getMediaContext GETs context", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      if (String(url).endsWith("/api/media/context"))
        return Response.json({ role: "admin", roles: [{ key: "editor", label: "Editor" }] })
      return Response.json({ id: "f1", name: "F", parentId: null, position: 0, roles: ["editor"] })
    }) as typeof fetch

    const folder = await setMediaFolderRoles("https://cms.example.test", "f1", ["editor"])
    const context = await getMediaContext("https://cms.example.test")

    expect(calls[0]?.url).toBe("https://cms.example.test/api/media/folders/f1")
    expect(calls[0]?.init?.method).toBe("PATCH")
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ roles: ["editor"] })
    expect(folder.roles).toEqual(["editor"])
    expect(calls[1]?.url).toBe("https://cms.example.test/api/media/context")
    expect(context.role).toBe("admin")
    expect(context.roles[0]?.key).toBe("editor")
  })

  test("folder style + reorder client fns PATCH the right body", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return Response.json({ id: "f1", name: "F", parentId: null, position: 0 })
    }) as typeof fetch

    await setMediaFolderColor("https://cms.example.test", "f1", "#abcdef")
    await setMediaFolderIcon("https://cms.example.test", "f1", "image")
    await reorderMediaFolder("https://cms.example.test", "f1", "up")

    expect(calls[0]?.url).toBe("https://cms.example.test/api/media/folders/f1")
    expect(calls[0]?.init?.method).toBe("PATCH")
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ color: "#abcdef" })
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({ icon: "image" })
    expect(JSON.parse(String(calls[2]?.init?.body))).toEqual({ direction: "up" })
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
    expect(mediaDisplayUrl("https://cdn.example.test/hero.jpg", "https://cms.example.test")).toBe(
      "https://cdn.example.test/hero.jpg",
    )
    expect(mediaDisplayUrl({ url: "/uploads/hero.jpg" }, "https://cms.example.test")).toBe(
      "https://cms.example.test/uploads/hero.jpg",
    )
  })
})
