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

  test("single DELETE fires onAssetsDeleted with the removed id", async () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const stored = await storage.store(new File(["x"], "x.txt", { type: "text/plain" }))
    const deleted: string[][] = []
    const handler = createMediaHandler(storage, { onAssetsDeleted: (ids) => deleted.push(ids) })

    const res = await handler(new Request(`https://cms.example.test/api/media/${stored.id}`, { method: "DELETE" }))

    expect((await res?.json()).deleted).toBe(true)
    expect(deleted).toEqual([[stored.id]])
    expect(storage.get(stored.id)).toBeNull()
  })

  test("single DELETE of a missing id does not fire onAssetsDeleted", async () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const deleted: string[][] = []
    const handler = createMediaHandler(storage, { onAssetsDeleted: (ids) => deleted.push(ids) })

    const res = await handler(new Request(`https://cms.example.test/api/media/missing`, { method: "DELETE" }))

    expect((await res?.json()).deleted).toBe(false)
    expect(deleted).toEqual([])
  })

  test("POST /api/media/delete removes records and returns only really-deleted ids", async () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const a = await storage.store(new File(["a"], "a.txt", { type: "text/plain" }))
    const b = await storage.store(new File(["b"], "b.txt", { type: "text/plain" }))
    const deleted: string[][] = []
    const handler = createMediaHandler(storage, { onAssetsDeleted: (ids) => deleted.push(ids) })

    const res = await handler(new Request("https://cms.example.test/api/media/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [a.id, "missing", b.id] }),
    }))

    const body = await res?.json()
    expect(body.deleted.sort()).toEqual([a.id, b.id].sort())
    expect(deleted[0]?.sort()).toEqual([a.id, b.id].sort())
    expect(storage.list()).toEqual([])
  })

  test("POST /api/media/delete rejects a non-array ids body", async () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const handler = createMediaHandler(storage)
    const res = await handler(new Request("https://cms.example.test/api/media/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: "nope" }),
    }))
    expect(res?.status).toBe(400)
  })

  test("enforces folder roles when getRole is provided", async () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const open = await storage.store(new File(["x"], "open.txt", { type: "text/plain" }))
    const restricted = storage.createFolder("Restricted", null)
    storage.setFolderRoles(restricted.id, ["editor"])
    const secret = await storage.store(new File(["x"], "secret.txt", { type: "text/plain" }))
    storage.moveAssets([secret.id], restricted.id)

    const asViewer = createMediaHandler(storage, { getRole: () => "viewer" })
    const asAdmin = createMediaHandler(storage, { getRole: () => "admin" })

    const viewerList = await (await asViewer(new Request("https://x/api/media")))!.json()
    expect(viewerList.data.map((r: any) => r.id)).toEqual([open.id])
    const adminList = await (await asAdmin(new Request("https://x/api/media")))!.json()
    expect(adminList.data.map((r: any) => r.id).sort()).toEqual([open.id, secret.id].sort())

    const viewerFolders = await (await asViewer(new Request("https://x/api/media/folders")))!.json()
    expect(viewerFolders.data.find((f: any) => f.id === restricted.id)).toBeUndefined()

    const viewerGet = await asViewer(new Request(`https://x/api/media/${secret.id}`))
    expect(viewerGet!.status).toBe(404)
    const adminGet = await asAdmin(new Request(`https://x/api/media/${secret.id}`))
    expect(adminGet!.status).toBe(200)
  })

  test("blocks moving into a restricted folder and role-setting for non-admins", async () => {
    const storage = createLocalStorage({ provider: "local", path: uploadsDir })
    const open = await storage.store(new File(["x"], "o.txt", { type: "text/plain" }))
    const restricted = storage.createFolder("R", null)
    storage.setFolderRoles(restricted.id, ["editor"])

    const asViewer = createMediaHandler(storage, { getRole: () => "viewer" })
    const move = await asViewer(new Request("https://x/api/media/move", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [open.id], folderId: restricted.id }),
    }))
    expect(move!.status).toBe(403)

    const setRoles = await asViewer(new Request(`https://x/api/media/folders/${restricted.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roles: ["viewer"] }),
    }))
    expect(setRoles!.status).toBe(403)

    const asAdmin = createMediaHandler(storage, { getRole: () => "admin" })
    const ok = await asAdmin(new Request(`https://x/api/media/folders/${restricted.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roles: ["author"] }),
    }))
    expect(ok!.status).toBe(200)
    expect((await ok!.json()).roles).toEqual(["author"])
  })
})
