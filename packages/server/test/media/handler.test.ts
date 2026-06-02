import { test, expect, describe, beforeAll, afterAll } from "bun:test"
import { createServer } from "../../src/index"
import { defineCollection, field } from "@not-a-cms/core"
import { unlinkSync, rmSync, existsSync } from "node:fs"

const testDbPath = "test-media.db"
const uploadsDir = "./test-uploads"

const page = defineCollection({ name: "page", fields: { title: field.text() } })

let baseUrl: string
let server: ReturnType<typeof createServer>
let latestMagicLink: string | null = null

describe("media API", () => {
  beforeAll(() => {
    latestMagicLink = null
    server = createServer({
      port: 0,
      database: { url: testDbPath },
      auth: {
        secret: "a".repeat(32),
        baseURL: "http://localhost",
        magicLink: {
          sendMagicLink: async ({ url }) => {
            latestMagicLink = url
          },
        },
      },
      collections: [page],
      storage: { provider: "local", path: uploadsDir },
    })
    baseUrl = `http://localhost:${server.server.port}`
  })

  afterAll(() => {
    server.server.stop()
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
    if (existsSync(uploadsDir)) rmSync(uploadsDir, { recursive: true })
  })

  test("POST /api/media/upload rejects anonymous uploads", async () => {
    const formData = new FormData()
    formData.append("file", new Blob(["hello world"], { type: "text/plain" }), "test.txt")
    const res = await fetch(`${baseUrl}/api/media/upload`, { method: "POST", body: formData })
    expect(res.status).toBe(401)
  })

  test("GET /api/media rejects anonymous listing", async () => {
    const res = await fetch(`${baseUrl}/api/media`)
    expect(res.status).toBe(401)
  })

  test("GET /api/media/:id/file is publicly routable", async () => {
    const res = await fetch(`${baseUrl}/api/media/missing-file/file`)
    expect(res.status).toBe(404)
  })

  test("DELETE /api/media/:id rejects anonymous deletion", async () => {
    const res = await fetch(`${baseUrl}/api/media/some-id`, { method: "DELETE" })
    expect(res.status).toBe(401)
  })

  test("PATCH /api/media/:id updates metadata and replace-file swaps the binary", async () => {
    const adminCookie = await signInAndGetCookie("media-admin@example.test")

    const formData = new FormData()
    formData.append("file", new Blob(["original"], { type: "text/plain" }), "original.txt")
    formData.append("alt", "Original alt")
    const upload = await fetch(`${baseUrl}/api/media/upload`, {
      method: "POST",
      headers: { cookie: adminCookie },
      body: formData,
    })
    expect(upload.status).toBe(201)
    const uploaded = await upload.json()

    const patch = await fetch(`${baseUrl}/api/media/${uploaded.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: adminCookie },
      body: JSON.stringify({
        alt: "Updated alt",
        title: "Hero asset",
        caption: "Homepage hero",
        focalX: 0.2,
        focalY: 0.8,
      }),
    })
    expect(patch.status).toBe(200)
    const patched = await patch.json()
    expect(patched.alt).toBe("Updated alt")
    expect(patched.caption).toBe("Homepage hero")
    expect(patched.focalX).toBe(0.2)
    expect(patched.path).toBeUndefined()

    const replaceForm = new FormData()
    replaceForm.append("file", new Blob(["replacement"], { type: "text/plain" }), "replacement.txt")
    const replace = await fetch(`${baseUrl}/api/media/${uploaded.id}/replace`, {
      method: "POST",
      headers: { cookie: adminCookie },
      body: replaceForm,
    })
    expect(replace.status).toBe(200)
    const replaced = await replace.json()
    expect(replaced.id).toBe(uploaded.id)
    expect(replaced.filename).toBe("replacement.txt")
    expect(replaced.alt).toBe("Updated alt")

    const file = await fetch(`${baseUrl}/api/media/${uploaded.id}/file`)
    expect(await file.text()).toBe("replacement")
  })

  test("PATCH /api/media/:id stores normalized tags and rejects non-array tags", async () => {
    const adminCookie = await signInAndGetCookie("media-admin@example.test")

    const formData = new FormData()
    formData.append("file", new Blob(["tagged"], { type: "text/plain" }), "tagged.txt")
    const upload = await fetch(`${baseUrl}/api/media/upload`, {
      method: "POST",
      headers: { cookie: adminCookie },
      body: formData,
    })
    expect(upload.status).toBe(201)
    const uploaded = await upload.json()

    const patch = await fetch(`${baseUrl}/api/media/${uploaded.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ tags: [" #Hero ", "Hero", "Summer Sale"] }),
    })
    expect(patch.status).toBe(200)
    const patched = await patch.json()
    expect(patched.tags).toEqual(["hero", "summer-sale"])

    const altOnly = await fetch(`${baseUrl}/api/media/${uploaded.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ alt: "Keep tags" }),
    })
    expect((await altOnly.json()).tags).toEqual(["hero", "summer-sale"])

    const bad = await fetch(`${baseUrl}/api/media/${uploaded.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ tags: "not-an-array" }),
    })
    expect(bad.status).toBe(400)
    expect((await bad.json()).error).toContain("tags")
  })

  test("POST /api/media/tags bulk-applies add/remove and skips missing ids", async () => {
    const adminCookie = await signInAndGetCookie("media-admin@example.test")

    const ids: string[] = []
    for (const name of ["one.txt", "two.txt"]) {
      const fd = new FormData()
      fd.append("file", new Blob(["x"], { type: "text/plain" }), name)
      const up = await fetch(`${baseUrl}/api/media/upload`, { method: "POST", headers: { cookie: adminCookie }, body: fd })
      ids.push((await up.json()).id)
    }

    const add = await fetch(`${baseUrl}/api/media/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ ids: [...ids, "missing-id"], add: [" #Campaign "] }),
    })
    expect(add.status).toBe(200)
    const addBody = await add.json()
    expect(addBody.data.length).toBe(2)
    expect(addBody.data.every((r: any) => r.tags.includes("campaign"))).toBe(true)

    const remove = await fetch(`${baseUrl}/api/media/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ ids: [ids[0]], remove: ["campaign"] }),
    })
    expect((await remove.json()).data[0].tags).toEqual([])
  })

  test("POST /api/media/tags rejects anonymous and bad bodies", async () => {
    const anon = await fetch(`${baseUrl}/api/media/tags`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: ["x"], add: ["y"] }),
    })
    expect(anon.status).toBe(401)

    const adminCookie = await signInAndGetCookie("media-admin@example.test")
    const bad = await fetch(`${baseUrl}/api/media/tags`, {
      method: "POST", headers: { "Content-Type": "application/json", cookie: adminCookie }, body: JSON.stringify({ ids: "nope" }),
    })
    expect(bad.status).toBe(400)
  })

  test("GET/PATCH/DELETE /api/media/tags manage the registry", async () => {
    const adminCookie = await signInAndGetCookie("media-admin@example.test")
    const fd = new FormData()
    fd.append("file", new Blob(["x"], { type: "text/plain" }), "a.txt")
    const up = await fetch(`${baseUrl}/api/media/upload`, { method: "POST", headers: { cookie: adminCookie }, body: fd })
    const id = (await up.json()).id
    await fetch(`${baseUrl}/api/media/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ tags: ["draft"] }),
    })

    const list = await fetch(`${baseUrl}/api/media/tags`, { headers: { cookie: adminCookie } })
    expect(list.status).toBe(200)
    expect((await list.json()).data.some((t: any) => t.name === "draft")).toBe(true)

    const recolor = await fetch(`${baseUrl}/api/media/tags/draft`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ color: "#abcdef" }),
    })
    expect((await recolor.json()).color).toBe("#abcdef")

    const rename = await fetch(`${baseUrl}/api/media/tags/draft`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ newName: "Working" }),
    })
    expect((await rename.json()).name).toBe("working")

    const del = await fetch(`${baseUrl}/api/media/tags/working`, { method: "DELETE", headers: { cookie: adminCookie } })
    expect((await del.json()).removed).toBe(1)
  })

  test("GET /api/media/tags rejects anonymous; PATCH rejects invalid color", async () => {
    expect((await fetch(`${baseUrl}/api/media/tags`)).status).toBe(401)
    const adminCookie = await signInAndGetCookie("media-registry-admin2@example.test")
    const bad = await fetch(`${baseUrl}/api/media/tags/x`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ color: "blue" }),
    })
    expect(bad.status).toBe(400)

    const badName = await fetch(`${baseUrl}/api/media/tags/x`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ newName: "###" }),
    })
    expect(badName.status).toBe(400)
  })

  test("folder routes + move: create, list, move asset, delete reassigns", async () => {
    const adminCookie = await signInAndGetCookie("media-admin@example.test")
    const mk = async (name: string, parentId: string | null = null) =>
      await (await fetch(`${baseUrl}/api/media/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: adminCookie },
        body: JSON.stringify({ name, parentId }),
      })).json()

    const brand = await mk("Brand")
    const logos = await mk("Logos", brand.id)
    const list = await fetch(`${baseUrl}/api/media/folders`, { headers: { cookie: adminCookie } })
    expect((await list.json()).data.length).toBe(2)

    const fd = new FormData()
    fd.append("file", new Blob(["x"], { type: "text/plain" }), "a.txt")
    const id = (await (await fetch(`${baseUrl}/api/media/upload`, { method: "POST", headers: { cookie: adminCookie }, body: fd })).json()).id

    const move = await fetch(`${baseUrl}/api/media/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ ids: [id], folderId: logos.id }),
    })
    expect((await move.json()).data[0].folderId).toBe(logos.id)

    const del = await fetch(`${baseUrl}/api/media/folders/${logos.id}`, { method: "DELETE", headers: { cookie: adminCookie } })
    expect((await del.json())).toEqual({ reassigned: 1, reparented: 0 })
  })

  test("folder routes reject anonymous and cycles", async () => {
    expect((await fetch(`${baseUrl}/api/media/folders`)).status).toBe(401)
    const adminCookie = await signInAndGetCookie("media-admin@example.test")
    const a = await (await fetch(`${baseUrl}/api/media/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ name: "A" }),
    })).json()
    const b = await (await fetch(`${baseUrl}/api/media/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ name: "B", parentId: a.id }),
    })).json()
    const cycle = await fetch(`${baseUrl}/api/media/folders/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ parentId: b.id }),
    })
    expect(cycle.status).toBe(400)
  })
})

async function signInAndGetCookie(email: string): Promise<string> {
  latestMagicLink = null
  const signIn = await fetch(`${baseUrl}/api/auth/sign-in/magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: baseUrl },
    body: JSON.stringify({ email }),
  })
  expect(signIn.status).toBe(200)
  expect(latestMagicLink).toBeTruthy()
  const verifyUrl = new URL(latestMagicLink!)
  const verify = await fetch(`${baseUrl}${verifyUrl.pathname}${verifyUrl.search}`, {
    redirect: "manual",
    headers: { origin: baseUrl },
  })
  const cookie = verify.headers.get("set-cookie")
  expect(cookie).toBeTruthy()
  return cookie!
}
