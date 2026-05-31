import { test, expect, describe, afterEach } from "bun:test"
import { existsSync, rmSync } from "node:fs"
import { createLocalStorage, createMediaStorage, createS3SignedRequest } from "../../src/media/storage"

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
