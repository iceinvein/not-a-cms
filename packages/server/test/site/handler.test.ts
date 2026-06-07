import { test, expect, describe, beforeAll, afterAll } from "bun:test"
import { createServer } from "../../src/index"
import { unlinkSync } from "node:fs"

const testDbPath = "test-site-api.db"

const siteConfig = {
  name: "Atelier",
  url: "https://atelier.studio",
  nav: {
    links: [
      { label: "Work", href: "/work" },
      { label: "About", href: "/about", external: false },
    ],
    cta: { label: "Start", href: "/contact" },
  },
  footer: {
    tagline: "Craft over noise.",
    columns: [
      {
        heading: "Studio",
        links: [{ label: "Work", href: "/work" }],
      },
    ],
    social: [{ label: "GitHub", href: "https://github.com/atelier" }],
    legal: "© 2026 Atelier",
  },
}

const routesConfig = [{ collection: "project", path: "/work/:slug" }]

const themeConfig = {
  name: "atelier-theme",
  version: "1.0.0",
  settings: {
    colors: { primary: { default: "#0a0a0a" } },
  },
}

describe("GET /api/_site", () => {
  let baseUrl: string
  let server: ReturnType<typeof createServer>

  let baseUrlEmpty: string
  let serverEmpty: ReturnType<typeof createServer>

  beforeAll(() => {
    server = createServer({
      port: 0,
      database: { url: testDbPath },
      auth: { secret: "a".repeat(32), baseURL: "http://localhost", magicLink: { sendMagicLink: async () => {} } },
      collections: [],
      site: siteConfig,
      theme: themeConfig,
      routes: routesConfig,
    })
    baseUrl = `http://localhost:${server.server.port}`

    serverEmpty = createServer({
      port: 0,
      database: { url: testDbPath + ".empty" },
      auth: { secret: "a".repeat(32), baseURL: "http://localhost", magicLink: { sendMagicLink: async () => {} } },
      collections: [],
    })
    baseUrlEmpty = `http://localhost:${serverEmpty.server.port}`
  })

  afterAll(() => {
    server.server.stop()
    serverEmpty.server.stop()
    for (const p of [testDbPath, testDbPath + ".empty"]) {
      try { unlinkSync(p) } catch {}
      try { unlinkSync(p + "-wal") } catch {}
      try { unlinkSync(p + "-shm") } catch {}
    }
  })

  test("returns full site identity when site is configured", async () => {
    const res = await fetch(`${baseUrl}/api/_site`)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.siteName).toBe("Atelier")
    expect(body.nav).toEqual(siteConfig.nav)
    expect(body.footer).toEqual(siteConfig.footer)
  })

  test("includes theme block alongside site fields", async () => {
    const res = await fetch(`${baseUrl}/api/_site`)
    const body = await res.json()

    expect(body.theme.name).toBe("atelier-theme")
    expect(body.theme.version).toBe("1.0.0")
    expect(body.theme.settings).toEqual(themeConfig.settings)
  })

  test("returns nulls for all fields when site is not configured", async () => {
    const res = await fetch(`${baseUrlEmpty}/api/_site`)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.siteName).toBeNull()
    expect(body.nav).toBeNull()
    expect(body.footer).toBeNull()
    expect(body.theme).toEqual({ name: null, version: null, settings: null })
  })

  test("returns configured routes in the response", async () => {
    const res = await fetch(`${baseUrl}/api/_site`)
    const body = await res.json()
    expect(body.routes).toEqual(routesConfig)
  })

  test("returns null for routes when none are configured", async () => {
    const res = await fetch(`${baseUrlEmpty}/api/_site`)
    const body = await res.json()
    expect(body.routes).toBeNull()
  })

  test("non-GET method returns 405", async () => {
    const res = await fetch(`${baseUrl}/api/_site`, { method: "POST" })
    expect(res.status).toBe(405)
  })
})
