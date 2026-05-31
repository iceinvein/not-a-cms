#!/usr/bin/env bun
/**
 * not-a-cms dev script
 *
 * Boots the API server, admin UI, and public site renderer together.
 * Usage: bun scripts/dev.ts [--port=4321] [--admin-port=4322] [--renderer-port=3000]
 */

const args = Bun.argv.slice(2)
const apiPort = args.find(a => a.startsWith("--port="))?.split("=")[1] ?? process.env.PORT ?? "4321"
const adminPort = args.find(a => a.startsWith("--admin-port="))?.split("=")[1] ?? process.env.ADMIN_PORT ?? "4322"
const rendererPort = args.find(a => a.startsWith("--renderer-port="))?.split("=")[1] ?? process.env.RENDERER_PORT ?? "3000"

console.log("  Starting API server...")

// Start API server (quiet banner, but show errors)
const api = Bun.spawn(["bun", "--hot", "packages/server/src/dev.ts"], {
  env: {
    ...process.env,
    PORT: apiPort,
    QUIET: "1",
    CORS_ORIGINS: `http://localhost:${adminPort},http://localhost:${rendererPort}`,
  },
  stdout: "inherit",
  stderr: "inherit",
})

// Wait for API to be ready
await waitForServer(`http://localhost:${apiPort}/health`, 10_000)

console.log("  Starting admin UI...")

// Start Admin UI (suppress Astro's verbose startup, keep errors)
const admin = Bun.spawn(["bunx", "astro", "dev", "--port", adminPort], {
  cwd: "packages/admin",
  env: { ...process.env, PUBLIC_API_BASE: `http://localhost:${apiPort}`, PUBLIC_SITE_BASE: `http://localhost:${rendererPort}` },
  stdout: "ignore",
  stderr: "ignore",
})

// Wait for admin to be ready
await waitForServer(`http://localhost:${adminPort}`, 15_000)

console.log("  Starting public site renderer...")

const renderer = Bun.spawn(["bunx", "astro", "dev", "--port", rendererPort], {
  cwd: "packages/renderer",
  env: { ...process.env, PUBLIC_API_BASE: `http://localhost:${apiPort}` },
  stdout: "ignore",
  stderr: "ignore",
})

await waitForServer(`http://localhost:${rendererPort}`, 15_000)

console.log(`
  not-a-cms dev server ready

  Admin:    http://localhost:${adminPort}
  Site:     http://localhost:${rendererPort}
  API:      http://localhost:${apiPort}/api
  Health:   http://localhost:${apiPort}/health
  Collab:   ws://localhost:${apiPort}/collab

  Ctrl+C to stop.
`)

// Handle shutdown
process.on("SIGINT", () => {
  console.log("\n  Shutting down...")
  api.kill()
  admin.kill()
  renderer.kill()
  process.exit(0)
})

process.on("SIGTERM", () => {
  api.kill()
  admin.kill()
  renderer.kill()
  process.exit(0)
})

// Keep alive
await Promise.all([api.exited, admin.exited, renderer.exited])

// --- Helpers ---

async function waitForServer(url: string, timeout: number) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {}
    await Bun.sleep(200)
  }
  console.error(`  Timed out waiting for ${url}`)
  process.exit(1)
}
