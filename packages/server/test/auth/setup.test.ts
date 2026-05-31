import { test, expect, describe, afterEach } from "bun:test"
import { createAuth, getAuthCapabilities } from "../../src/auth/setup"
import { bootstrapTables, createDatabase } from "@not-a-cms/core"
import { unlinkSync } from "node:fs"

const testDbPath = "test-auth.db"

describe("auth setup", () => {
  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("createAuth returns an auth instance with handler", () => {
    const db = createDatabase({ url: testDbPath })
    const auth = createAuth({
      db,
      secret: "a".repeat(32),
      baseURL: "http://localhost:3000",
      magicLink: { sendMagicLink: async () => {} },
    })
    expect(auth.handler).toBeDefined()
    expect(typeof auth.handler).toBe("function")
  })

  test("auth handler responds to health check", async () => {
    const db = createDatabase({ url: testDbPath })
    const auth = createAuth({
      db,
      secret: "a".repeat(32),
      baseURL: "http://localhost:3000",
      magicLink: { sendMagicLink: async () => {} },
    })
    // Better Auth typically responds to GET /api/auth/ok with 200
    const req = new Request("http://localhost:3000/api/auth/ok")
    const res = await auth.handler(req)
    expect(res.status).toBe(200)
  })

  test("magic link sign-in stores a verification token and sends a link", async () => {
    const db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [])
    let sent: { email: string; url: string; token: string } | undefined
    const auth = createAuth({
      db,
      secret: "a".repeat(32),
      baseURL: "http://localhost:3000/api/auth",
      magicLink: {
        sendMagicLink: async (params) => {
          sent = params
        },
      },
    })

    const req = new Request("http://localhost:3000/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email: "admin@example.test" }),
    })
    const res = await auth.handler(req)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: true })
    expect(sent?.email).toBe("admin@example.test")
    expect(sent?.url).toContain("/api/auth/magic-link/verify")
    expect(sent?.token).toBeTruthy()
  })

  test("magic link sign-in accepts callback URLs from trusted admin origins", async () => {
    const db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [])
    let sent: { email: string; url: string; token: string } | undefined
    const auth = createAuth({
      db,
      secret: "a".repeat(32),
      baseURL: "http://localhost:3000/api/auth",
      trustedOrigins: ["http://localhost:4322"],
      magicLink: {
        sendMagicLink: async (params) => {
          sent = params
        },
      },
    })

    const res = await auth.handler(new Request("http://localhost:3000/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: "http://localhost:4322" },
      body: JSON.stringify({ email: "admin@example.test", callbackURL: "http://localhost:4322/" }),
    }))

    expect(res.status).toBe(200)
    expect(sent?.url).toContain("callbackURL=http%3A%2F%2Flocalhost%3A4322%2F")
  })

  test("getAuthCapabilities exposes configured OAuth providers without passkey support", () => {
    const capabilities = getAuthCapabilities({
      db: createDatabase({ url: testDbPath }),
      secret: "a".repeat(32),
      baseURL: "http://localhost:3000/api/auth",
      magicLink: { sendMagicLink: async () => {} },
      oauth: {
        github: { clientId: "github-id", clientSecret: "github-secret" },
        google: { clientId: "google-id", clientSecret: "google-secret" },
      },
    })

    expect(capabilities).toEqual({
      magicLink: true,
      oauthProviders: ["github", "google"],
      passkey: false,
    })
  })

  test("configured OAuth providers can start social sign-in", async () => {
    const db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [])
    const auth = createAuth({
      db,
      secret: "a".repeat(32),
      baseURL: "http://localhost:3000",
      magicLink: { sendMagicLink: async () => {} },
      oauth: {
        github: { clientId: "github-id", clientSecret: "github-secret" },
      },
    })

    const res = await auth.handler(new Request("http://localhost:3000/api/auth/sign-in/social", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ provider: "github", callbackURL: "/" }),
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.redirect).toBe(true)
    expect(body.url).toContain("https://github.com/login/oauth/authorize")
    expect(body.url).toContain("client_id=github-id")
  })
})
