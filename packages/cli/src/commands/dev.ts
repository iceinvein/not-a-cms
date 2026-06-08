import { dirname } from "node:path"
import { type CMSConfig, loadConfig } from "@not-a-cms/core"
import { registerCommand } from "../router"

type DevPorts = {
  apiPort: string
  adminPort: string
  rendererPort: string
}

type DevProcessSpec = {
  command: string[]
  cwd: string
  env: Record<string, string>
}

type UserStorageConfig =
  | { provider: "local"; path?: string }
  | {
      provider: "s3" | "r2"
      path?: string
      bucket?: string
      endpoint?: string
      region?: string
      accessKeyId?: string
      secretAccessKey?: string
      publicUrl?: string
      prefix?: string
    }

type DevServerOptionsInput = {
  userConfig: CMSConfig & { components?: unknown[] }
  ports: DevPorts
  env: Record<string, string | undefined>
}

export function parseDevPorts(
  args: string[],
  env: Record<string, string | undefined>,
  configPort?: number,
): DevPorts {
  const apiPort =
    args.find((a) => a.startsWith("--port="))?.split("=")[1] ??
    env.PORT ??
    String(configPort ?? 4321)
  const adminPort =
    args.find((a) => a.startsWith("--admin-port="))?.split("=")[1] ?? env.ADMIN_PORT ?? "4322"
  const rendererPort =
    args.find((a) => a.startsWith("--renderer-port="))?.split("=")[1] ?? env.RENDERER_PORT ?? "3000"
  return { apiPort, adminPort, rendererPort }
}

export function createDevProcessSpecs(
  options: DevPorts & {
    adminDir: string
    rendererDir: string
    siteName?: string
    siteUrl?: string
    channels?: unknown
  },
): {
  admin: DevProcessSpec
  renderer: DevProcessSpec
} {
  const apiBase = `http://localhost:${options.apiPort}`
  const siteBase = options.siteUrl ?? `http://localhost:${options.rendererPort}`
  const channelConfig = JSON.stringify({
    site: {
      ...(options.siteName ? { name: options.siteName } : {}),
      url: siteBase,
    },
    ...(options.channels ? { channels: options.channels } : {}),
  })
  return {
    admin: {
      command: ["bunx", "astro", "dev", "--port", options.adminPort, "--host", "127.0.0.1"],
      cwd: options.adminDir,
      env: { PUBLIC_API_BASE: apiBase, PUBLIC_SITE_BASE: siteBase },
    },
    renderer: {
      command: ["bunx", "astro", "dev", "--port", options.rendererPort, "--host", "127.0.0.1"],
      cwd: options.rendererDir,
      env: {
        PUBLIC_API_BASE: apiBase,
        PUBLIC_SITE_BASE: siteBase,
        NOT_A_CMS_CHANNEL_CONFIG: channelConfig,
      },
    },
  }
}

export function resolveStorageConfig(storage: UserStorageConfig | undefined) {
  if (!storage) return undefined
  if (storage.provider === "local") {
    return storage.path ? { provider: "local" as const, path: storage.path } : undefined
  }
  return {
    provider: storage.provider,
    path: storage.path,
    bucket: storage.bucket,
    endpoint: storage.endpoint,
    region: storage.region,
    accessKeyId: storage.accessKeyId,
    secretAccessKey: storage.secretAccessKey,
    publicUrl: storage.publicUrl,
    prefix: storage.prefix,
  }
}

export function createDevServerOptions({ userConfig, ports, env }: DevServerOptionsInput) {
  return {
    port: parseInt(ports.apiPort, 10),
    database: {
      url: userConfig.database?.url ?? env.DATABASE_URL ?? "data.db",
    },
    auth: {
      secret: env.BETTER_AUTH_SECRET ?? "dev-secret-change-me-" + "x".repeat(16),
      baseURL: userConfig.site?.url ?? env.BASE_URL ?? `http://localhost:${ports.apiPort}`,
      magicLink: {
        sendMagicLink: async ({ email, url }: { email: string; url: string }) => {
          console.log(`\n  Magic link for ${email}: ${url}\n`)
        },
      },
    },
    storage: resolveStorageConfig(userConfig.storage),
    collections: userConfig.collections ?? [],
    components: (userConfig.components ?? []) as any[],
    cors: {
      origins: [`http://localhost:${ports.adminPort}`, `http://localhost:${ports.rendererPort}`],
    },
  }
}

registerCommand({
  name: "dev",
  description: "Start the development server",
  async run(args) {
    console.log("Starting not-a-cms dev server...")

    // Track spawned children so a startup failure tears them down instead of
    // orphaning an astro process that already holds a port.
    const children: Bun.Subprocess[] = []
    try {
      const userConfig = await loadConfig({ cwd: process.cwd() })
      const { apiPort, adminPort, rendererPort } = parseDevPorts(args, process.env, userConfig.port)

      // Import server dynamically (may not be in CLI's own deps)
      const { createServer } = await import("@not-a-cms/server")

      const serverInstance = createServer(
        createDevServerOptions({
          userConfig,
          ports: { apiPort, adminPort, rendererPort },
          env: process.env,
        }),
      )

      const specs = createDevProcessSpecs({
        apiPort,
        adminPort,
        rendererPort,
        adminDir: resolvePackageDir("@not-a-cms/admin"),
        rendererDir: resolvePackageDir("@not-a-cms/renderer"),
        siteName: userConfig.site?.name,
        siteUrl: userConfig.site?.url,
        channels: userConfig.channels,
      })

      const admin = spawnDevProcess(specs.admin)
      children.push(admin)
      await waitForServer(`http://127.0.0.1:${adminPort}`, 15_000)

      const renderer = spawnDevProcess(specs.renderer)
      children.push(renderer)
      await waitForServer(`http://127.0.0.1:${rendererPort}`, 15_000)

      console.log(`
  not-a-cms dev server ready

  Admin:    http://localhost:${adminPort}
  Site:     http://localhost:${rendererPort}
  API:      http://localhost:${apiPort}/api
  Health:   http://localhost:${apiPort}/health
  Collab:   ws://localhost:${apiPort}/collab

  Ctrl+C to stop.
`)

      const shutdown = () => {
        admin.kill()
        renderer.kill()
        serverInstance.server.stop()
        process.exit(0)
      }

      process.on("SIGINT", shutdown)
      process.on("SIGTERM", shutdown)

      await Promise.all([admin.exited, renderer.exited])
    } catch (err: any) {
      for (const child of children) {
        try {
          child.kill()
        } catch {}
      }
      console.error("Failed to start dev server:", err.message)
      if (err?.code === "CONFIG_NOT_FOUND") {
        console.error("Run 'not-a-cms init' to create a project first")
      }
      process.exit(1)
    }
  },
})

function spawnDevProcess(spec: DevProcessSpec) {
  return Bun.spawn(spec.command, {
    cwd: spec.cwd,
    env: { ...process.env, ...spec.env },
    stdout: "inherit",
    stderr: "inherit",
  })
}

function resolvePackageDir(packageName: string): string {
  return dirname(Bun.resolveSync(`${packageName}/astro.config.ts`, import.meta.dir))
}

async function waitForServer(url: string, timeout: number) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {}
    await Bun.sleep(200)
  }
  throw new Error(`Timed out waiting for ${url}`)
}
