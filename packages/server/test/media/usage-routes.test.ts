import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { defineCollection, field } from "@not-a-cms/core"
import { existsSync, rmSync, unlinkSync } from "node:fs"
import { createServer } from "../../src/index"

const testDbPath = "test-media-usage-routes.db"
const uploadsDir = "./test-media-usage-uploads"

const article = defineCollection({
  name: "article",
  fields: {
    title: field.text({ required: true }),
    coverImage: field.media({ accept: ["image/*"] }),
  },
})

let baseUrl: string
let server: ReturnType<typeof createServer>
let latestMagicLink: string | null = null

describe("media usage routes", () => {
  beforeAll(async () => {
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
      collections: [article],
      storage: { provider: "local", path: uploadsDir },
    })
    baseUrl = `http://localhost:${server.server.port}`

    await server.collections.get("article")!.service.create({
      title: "Vault Launch",
      coverImage: "img1",
    })
  })

  afterAll(() => {
    server.server.stop()
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(`${testDbPath}-wal`) } catch {}
    try { unlinkSync(`${testDbPath}-shm`) } catch {}
    if (existsSync(uploadsDir)) rmSync(uploadsDir, { recursive: true })
  })

  test("GET /api/media/:id/usage returns exact media-field references", async () => {
    const cookie = await signInAndGetCookie("vault-routes@example.test")
    const res = await fetch(`${baseUrl}/api/media/img1/usage`, { headers: { cookie } })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(1)
    expect(body.references).toEqual([
      expect.objectContaining({
        collection: "article",
        field: "coverImage",
        label: "Vault Launch",
      }),
    ])
  })

  test("GET /api/media/usage returns per-asset counts", async () => {
    const cookie = await signInAndGetCookie("vault-counts@example.test")
    const res = await fetch(`${baseUrl}/api/media/usage`, { headers: { cookie } })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.counts).toEqual({ img1: 1 })
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
