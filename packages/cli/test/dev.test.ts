import { describe, expect, test } from "bun:test"
import { createDevProcessSpecs, createDevServerOptions, parseDevPorts, resolveStorageConfig } from "../src/commands/dev"

describe("dev command wiring", () => {
  test("parses API, admin, and renderer ports", () => {
    const ports = parseDevPorts(["--port=5000", "--admin-port=5001", "--renderer-port=5002"], {}, 4321)

    expect(ports).toEqual({ apiPort: "5000", adminPort: "5001", rendererPort: "5002" })
  })

  test("creates admin and renderer process specs with API and site bases", () => {
    const specs = createDevProcessSpecs({
      apiPort: "5000",
      adminPort: "5001",
      rendererPort: "5002",
      adminDir: "/repo/packages/admin",
      rendererDir: "/repo/packages/renderer",
      siteName: "Example",
      channels: { rss: { title: "Example Feed" } },
    })

    expect(specs.admin.cwd).toBe("/repo/packages/admin")
    expect(specs.admin.env.PUBLIC_API_BASE).toBe("http://localhost:5000")
    expect(specs.admin.env.PUBLIC_SITE_BASE).toBe("http://localhost:5002")
    expect(specs.renderer.cwd).toBe("/repo/packages/renderer")
    expect(specs.renderer.env.PUBLIC_API_BASE).toBe("http://localhost:5000")
    expect(specs.renderer.env.PUBLIC_SITE_BASE).toBe("http://localhost:5002")
    expect(JSON.parse(specs.renderer.env.NOT_A_CMS_CHANNEL_CONFIG)).toEqual({
      site: { name: "Example", url: "http://localhost:5002" },
      channels: { rss: { title: "Example Feed" } },
    })
  })

  test("passes S3-compatible storage config through to the server", () => {
    expect(resolveStorageConfig({
      provider: "r2",
      path: ".media-index",
      bucket: "media",
      endpoint: "https://account.r2.cloudflarestorage.com",
      region: "auto",
      accessKeyId: "key",
      secretAccessKey: "secret",
      prefix: "uploads",
    })).toEqual({
      provider: "r2",
      path: ".media-index",
      bucket: "media",
      endpoint: "https://account.r2.cloudflarestorage.com",
      region: "auto",
      accessKeyId: "key",
      secretAccessKey: "secret",
      publicUrl: undefined,
      prefix: "uploads",
    })
  })

  test("creates server options from user config and parsed ports", () => {
    const options = createDevServerOptions({
      userConfig: {
        site: { url: "http://example.test" },
        port: 5000,
        database: { provider: "sqlite", url: "site.db" },
        storage: { provider: "local", path: "media" },
        collections: [],
      },
      ports: { apiPort: "5000", adminPort: "5001", rendererPort: "5002" },
      env: { BETTER_AUTH_SECRET: "secret".repeat(8) },
    })

    expect(options.port).toBe(5000)
    expect(options.database.url).toBe("site.db")
    expect(options.auth.baseURL).toBe("http://example.test")
    expect(options.storage).toEqual({ provider: "local", path: "media" })
    expect(options.cors?.origins).toEqual(["http://localhost:5001", "http://localhost:5002"])
  })
})
