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
