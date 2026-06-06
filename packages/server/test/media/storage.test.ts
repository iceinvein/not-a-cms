import { test, expect, describe, afterEach } from "bun:test"
import { existsSync, rmSync } from "node:fs"
import {
  applyTagOps,
  createLocalStorage,
  createMediaStorage,
  createS3SignedRequest,
  defaultTagColor,
  isDescendant,
} from "../../src/media/storage"

const uploadsDir = "./test-storage-uploads"

describe("local media storage", () => {
  afterEach(() => {
    if (existsSync(uploadsDir)) rmSync(uploadsDir, { recursive: true })
  })

  test("persists media records across storage instances", async () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const stored = await storage.store(new File(["hello"], "hello.txt", { type: "text/plain" }))

    const restartedStorage = createLocalStorage({ provider: "local", path: uploadsDir })

    expect(restartedStorage.get(stored.id)?.filename).toBe("hello.txt")
    expect(restartedStorage.list().map((record) => record.id)).toContain(stored.id)
  })

  test("updates metadata and persists it", async () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const stored = await storage.store(new File(["hello"], "hero.txt", { type: "text/plain" }), {
      alt: "Original alt",
      title: "Hero",
    })

    const updated = storage.update(stored.id, {
      alt: "Updated alt",
      caption: "Homepage hero",
      focalX: 0.25,
      focalY: 0.75,
    })
    const restartedStorage = createLocalStorage({ provider: "local", path: uploadsDir })

    expect(updated?.alt).toBe("Updated alt")
    expect(updated?.title).toBe("Hero")
    expect(updated?.caption).toBe("Homepage hero")
    expect(updated?.focalX).toBe(0.25)
    expect(restartedStorage.get(stored.id)?.caption).toBe("Homepage hero")
  })

  test("replaceFile() preserves metadata while replacing file attributes", async () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const stored = await storage.store(new File(["old"], "old.txt", { type: "text/plain" }), {
      alt: "Existing alt",
      caption: "Keep this",
    })

    const replaced = await storage.replaceFile(stored.id, new File(["new content"], "new.txt", { type: "text/plain" }))

    expect(replaced?.id).toBe(stored.id)
    expect(replaced?.filename).toBe("new.txt")
    expect(replaced?.size).toBe("new content".length)
    expect(replaced?.alt).toBe("Existing alt")
    expect(replaced?.caption).toBe("Keep this")
  })

  test("normalizes and persists tags on store and update", async () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const stored = await storage.store(new File(["x"], "x.txt", { type: "text/plain" }), {
      tags: ["  #Hero ", "Hero", "Summer Sale", ""],
    })

    expect(stored.tags).toEqual(["hero", "summer-sale"])

    const updated = storage.update(stored.id, { tags: ["Logos"] })
    expect(updated?.tags).toEqual(["logos"])

    const restarted = createLocalStorage({ provider: "local", path: uploadsDir })
    expect(restarted.get(stored.id)?.tags).toEqual(["logos"])
  })

  test("omitting tags on update preserves existing tags; empty array clears them", async () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const stored = await storage.store(new File(["x"], "x.txt", { type: "text/plain" }), { tags: ["keep"] })

    const afterAltOnly = storage.update(stored.id, { alt: "Alt only" })
    expect(afterAltOnly?.tags).toEqual(["keep"])

    const afterClear = storage.update(stored.id, { tags: [] })
    expect(afterClear?.tags).toEqual([])
  })

  test("caps tag length at 25 chars and tag count at 30", async () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const many = Array.from({ length: 40 }, (_, i) => `tag-${i}`)
    const stored = await storage.store(new File(["x"], "x.txt", { type: "text/plain" }), {
      tags: ["a".repeat(40), ...many],
    })
    expect(stored.tags?.[0]).toBe("a".repeat(25))
    expect(stored.tags?.length).toBe(30)
  })

  test("applyTagOps adds, removes, normalizes and dedupes", () => {
    expect(applyTagOps(["hero"], ["#Launch", "hero"], [])).toEqual(["hero", "launch"])
    expect(applyTagOps(["hero", "launch"], [], ["Launch"])).toEqual(["hero"])
    expect(applyTagOps(["hero"], ["hero"], [])).toEqual(["hero"])
    expect(applyTagOps([], ["Summer Sale"], [])).toEqual(["summer-sale"])
  })

  test("defaultTagColor is deterministic and a valid hex", () => {
    const c1 = defaultTagColor("hero")
    expect(c1).toMatch(/^#[0-9a-f]{6}$/i)
    expect(defaultTagColor("hero")).toBe(c1)
  })

  test("setTagColor persists a custom color; tagColors reads it back", () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    storage.setTagColor("Hero", "#abcdef")
    expect(storage.tagColors()["hero"]).toBe("#abcdef")
    const restarted = createLocalStorage({ provider: "local", path: uploadsDir })
    expect(restarted.tagColors()["hero"]).toBe("#abcdef")
  })

  test("setTagColor rejects invalid hex", () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    expect(() => storage.setTagColor("hero", "blue")).toThrow()
  })

  test("renameTag rewrites all records and moves the color, returns count", async () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const a = await storage.store(new File(["x"], "a.txt"), { tags: ["2024"] })
    const b = await storage.store(new File(["x"], "b.txt"), { tags: ["2024", "hero"] })
    storage.setTagColor("2024", "#abcdef")

    const changed = storage.renameTag("2024", "FY2024")
    expect(changed).toBe(2)
    expect(storage.get(a.id)?.tags).toEqual(["fy2024"])
    expect(storage.get(b.id)?.tags).toEqual(["hero", "fy2024"])
    expect(storage.tagColors()["fy2024"]).toBe("#abcdef")
    expect(storage.tagColors()["2024"]).toBeUndefined()
  })

  test("removeTag strips from all records and deletes the registry entry", async () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const a = await storage.store(new File(["x"], "a.txt"), { tags: ["junk", "keep"] })
    storage.setTagColor("junk", "#abcdef")
    expect(storage.removeTag("junk")).toBe(1)
    expect(storage.get(a.id)?.tags).toEqual(["keep"])
    expect(storage.tagColors()["junk"]).toBeUndefined()
  })

  test("listTags unions names with counts and colors", async () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    await storage.store(new File(["x"], "a.txt"), { tags: ["hero", "2024"] })
    await storage.store(new File(["x"], "b.txt"), { tags: ["2024"] })
    const list = storage.listTags()
    expect(list.map((t) => [t.name, t.count])).toEqual([["2024", 2], ["hero", 1]])
    expect(list.every((t) => /^#[0-9a-f]{6}$/i.test(t.color))).toBe(true)
  })

  test("tag description/group set, clear, and survive setTagColor", async () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    await storage.store(new File(["x"], "a.txt"), { tags: ["hero"] })
    storage.setTagDescription("hero", "Homepage hero shots")
    storage.setTagGroup("hero", "Marketing")
    storage.setTagColor("hero", "#123456")
    let entry = storage.listTags().find((t) => t.name === "hero")!
    expect(entry.description).toBe("Homepage hero shots")
    expect(entry.group).toBe("Marketing")
    expect(entry.color).toBe("#123456")
    storage.setTagDescription("hero", null)
    entry = storage.listTags().find((t) => t.name === "hero")!
    expect(entry.description).toBeUndefined()
    expect(entry.group).toBe("Marketing")
  })

  test("mergeTag moves assets to the target, drops the source, keeps target metadata", async () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const a = await storage.store(new File(["x"], "a.txt"), { tags: ["old"] })
    const b = await storage.store(new File(["x"], "b.txt"), { tags: ["old", "new"] })
    storage.setTagColor("new", "#abcdef")
    storage.setTagDescription("new", "Target tag")
    expect(storage.mergeTag("old", "new")).toBe(2)
    expect(storage.get(a.id)?.tags).toEqual(["new"])
    expect(storage.get(b.id)?.tags).toEqual(["new"])
    const entry = storage.listTags().find((t) => t.name === "new")!
    expect(entry.color).toBe("#abcdef")
    expect(entry.description).toBe("Target tag")
    expect(storage.listTags().find((t) => t.name === "old")).toBeUndefined()
    expect(storage.mergeTag("x", "x")).toBe(0)
  })

  test("folder CRUD: create, rename, move with cycle rejection", () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const brand = storage.createFolder("Brand", null)
    const logos = storage.createFolder("Logos", brand.id)
    expect(storage.listFolders().map((f) => f.name).sort()).toEqual(["Brand", "Logos"])
    expect(storage.renameFolder(logos.id, "Marks")?.name).toBe("Marks")
    expect(() => storage.moveFolder(brand.id, logos.id)).toThrow()
    expect(storage.moveFolder(logos.id, null)?.parentId).toBeNull()
  })

  test("createFolder assigns increasing position among siblings", () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const a = storage.createFolder("A", null)
    const b = storage.createFolder("B", null)
    const childA = storage.createFolder("Child", a.id)
    expect(a.position).toBe(0)
    expect(b.position).toBe(1)
    expect(childA.position).toBe(0) // first child of A, separate sibling group
  })

  test("setFolderColor sets and clears, rejects bad hex", () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const f = storage.createFolder("F", null)
    expect(storage.setFolderColor(f.id, "#abcdef")?.color).toBe("#abcdef")
    expect(storage.setFolderColor(f.id, null)?.color).toBeUndefined()
    expect(() => storage.setFolderColor(f.id, "red")).toThrow()
    expect(storage.setFolderColor("missing", "#abcdef")).toBeNull()
  })

  test("setFolderIcon sets and clears, rejects bad key", () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const f = storage.createFolder("F", null)
    expect(storage.setFolderIcon(f.id, "image")?.icon).toBe("image")
    expect(storage.setFolderIcon(f.id, null)?.icon).toBeUndefined()
    expect(() => storage.setFolderIcon(f.id, "BadKey!")).toThrow()
  })

  test("reorderFolder swaps adjacent siblings and no-ops at the ends", () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const a = storage.createFolder("A", null)
    const b = storage.createFolder("B", null)
    const c = storage.createFolder("C", null)
    const ordered = () =>
      storage.listFolders().filter((f) => f.parentId === null).sort((x, y) => x.position - y.position).map((f) => f.name)
    storage.reorderFolder(b.id, "up")
    expect(ordered()).toEqual(["B", "A", "C"])
    storage.reorderFolder(b.id, "up") // already at top -> no-op
    expect(ordered()).toEqual(["B", "A", "C"])
    storage.reorderFolder(c.id, "down") // already at bottom -> no-op
    expect(ordered()).toEqual(["B", "A", "C"])
  })

  test("removeFolder reassigns assets and reparents children to the parent", async () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const brand = storage.createFolder("Brand", null)
    const logos = storage.createFolder("Logos", brand.id)
    const child = storage.createFolder("Old", logos.id)
    const asset = await storage.store(new File(["x"], "a.txt"))
    storage.moveAssets([asset.id], logos.id)

    const result = storage.removeFolder(logos.id)
    expect(result).toEqual({ reassigned: 1, reparented: 1 })
    expect(storage.get(asset.id)?.folderId).toBe(brand.id)
    expect(storage.listFolders().find((f) => f.id === child.id)?.parentId).toBe(brand.id)
  })

  test("moveAssets validates target and clears folder on null", async () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const f = storage.createFolder("F", null)
    const asset = await storage.store(new File(["x"], "a.txt"))
    storage.moveAssets([asset.id], f.id)
    expect(storage.get(asset.id)?.folderId).toBe(f.id)
    storage.moveAssets([asset.id], null)
    expect(storage.get(asset.id)?.folderId).toBeUndefined()
    expect(() => storage.moveAssets([asset.id], "nope")).toThrow()
  })

  test("isDescendant detects ancestry", () => {
    const folders = [
      { id: "a", name: "a", parentId: null },
      { id: "b", name: "b", parentId: "a" },
      { id: "c", name: "c", parentId: "b" },
    ]
    expect(isDescendant(folders, "a", "c")).toBe(true)
    expect(isDescendant(folders, "c", "a")).toBe(false)
  })

  test("createMediaStorage() creates a deterministic local provider", async () => {
    const storage = createMediaStorage({ provider: "local", path: uploadsDir })
    const stored = await storage.store(new File(["local"], "local.txt", { type: "text/plain" }))
    const file = await storage.getFile(stored.id)

    expect(stored.path).toContain(stored.id)
    expect(file?.filename).toBe("local.txt")
    expect(await file?.body.text()).toBe("local")
  })
})

describe("s3 media storage", () => {
  afterEach(() => {
    if (existsSync(uploadsDir)) rmSync(uploadsDir, { recursive: true })
  })

  test("signs S3-compatible requests with AWS v4 headers", () => {
    const signed = createS3SignedRequest({
      method: "PUT",
      endpoint: "https://storage.example.test",
      bucket: "media",
      region: "auto",
      key: "uploads/hero image.png",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      date: new Date("2026-05-31T08:00:00.000Z"),
      headers: { "content-type": "image/png" },
      payloadHash: "UNSIGNED-PAYLOAD",
    })

    expect(signed.url).toBe("https://storage.example.test/media/uploads/hero%20image.png")
    expect(signed.headers["x-amz-date"]).toBe("20260531T080000Z")
    expect(signed.headers.authorization).toContain("Credential=test-access-key/20260531/auto/s3/aws4_request")
    expect(signed.headers.authorization).toContain("SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date")
    expect(signed.headers.authorization).toMatch(/Signature=[a-f0-9]{64}$/)
  })

  test("stores, reads, and deletes objects through an S3-compatible provider", async () => {
    const calls: Array<{ method: string; url: string; authorization: string | null }> = []
    const storage = createMediaStorage({
      provider: "s3",
      path: uploadsDir,
      bucket: "media",
      endpoint: "https://storage.example.test",
      region: "auto",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      fetch: async (input, init) => {
        const url = input instanceof Request ? input.url : String(input)
        const method = init?.method ?? "GET"
        const headers = new Headers(init?.headers)
        calls.push({ method, url, authorization: headers.get("authorization") })
        if (method === "GET") return new Response("remote object", { status: 200 })
        return new Response(null, { status: method === "PUT" ? 200 : 204 })
      },
    })

    const stored = await storage.store(new File(["remote"], "remote.txt", { type: "text/plain" }))
    const file = await storage.getFile(stored.id)
    const removed = await storage.remove(stored.id)

    expect(stored.path).toBe(`${stored.id}.txt`)
    expect(file?.filename).toBe("remote.txt")
    expect(await file?.body.text()).toBe("remote object")
    expect(removed).toBe(true)
    expect(calls.map((call) => call.method)).toEqual(["PUT", "GET", "DELETE"])
    expect(calls.every((call) => call.authorization?.startsWith("AWS4-HMAC-SHA256 "))).toBe(true)
  })
})
