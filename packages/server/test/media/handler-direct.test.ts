import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, rmSync } from "node:fs"
import { createMediaHandler } from "../../src/media/handler"
import { createLocalStorage } from "../../src/media/storage"
import { createImageOptimizer } from "../../src/media/optimizer"

const uploadsDir = "./test-media-handler-direct"

afterEach(() => {
  if (existsSync(uploadsDir)) rmSync(uploadsDir, { recursive: true })
})

describe("media handler file responses", () => {
  test("adds browser-loadable file URLs to records", async () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const stored = await storage.store(new File(["hello"], "hello.txt", { type: "text/plain" }))
    const handler = createMediaHandler(storage)

    const res = await handler(new Request("https://cms.example.test/api/media"))
    const body = await res?.json()

    expect(body.data[0].id).toBe(stored.id)
    expect(body.data[0].url).toBe(`/api/media/${stored.id}/file`)
    expect(body.data[0].path).toBeUndefined()
  })

  test("serves the original uploaded file", async () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const stored = await storage.store(new File(["hello"], "hello.txt", { type: "text/plain" }))
    const handler = createMediaHandler(storage)

    const res = await handler(new Request(`https://cms.example.test/api/media/${stored.id}/file`))

    expect(res?.status).toBe(200)
    expect(res?.headers.get("Content-Type")?.startsWith("text/plain")).toBe(true)
    expect(await res?.text()).toBe("hello")
  })

  test("serves safe generated image variants through query params", async () => {
    const { default: sharp } = await import("sharp")
    const inputBuffer = await sharp({
      create: { width: 1200, height: 800, channels: 3, background: { r: 40, g: 120, b: 200 } },
    }).png().toBuffer()
    const storage = createLocalStorage({ provider: "local", path: uploadsDir }, createImageOptimizer(uploadsDir))
    const stored = await storage.store(new File([inputBuffer], "hero.png", { type: "image/png" }))
    const handler = createMediaHandler(storage)

    const listRes = await handler(new Request("https://cms.example.test/api/media"))
    const listBody = await listRes?.json()
    const variant = listBody.data[0].variants.find((item: any) => item.format === "webp")
    const transformed = await handler(new Request(`https://cms.example.test/api/media/${stored.id}/file?w=320&format=webp`))

    expect(variant.path).toBe(`/api/media/${stored.id}/file?w=${variant.width}&format=webp`)
    expect(variant.path).not.toContain(uploadsDir)
    expect(transformed?.status).toBe(200)
    expect(transformed?.headers.get("Content-Type")).toBe("image/webp")
    expect((await transformed?.arrayBuffer())?.byteLength).toBeGreaterThan(0)
  })

  test("rejects unsafe image transform params", async () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const stored = await storage.store(new File(["hello"], "hello.txt", { type: "text/plain" }))
    const handler = createMediaHandler(storage)

    const hugeWidth = await handler(new Request(`https://cms.example.test/api/media/${stored.id}/file?w=99999&format=webp`))
    const unknownFormat = await handler(new Request(`https://cms.example.test/api/media/${stored.id}/file?w=320&format=svg`))
    const missingFormat = await handler(new Request(`https://cms.example.test/api/media/${stored.id}/file?w=320`))

    expect(hugeWidth?.status).toBe(400)
    expect(unknownFormat?.status).toBe(400)
    expect(missingFormat?.status).toBe(400)
  })
})
