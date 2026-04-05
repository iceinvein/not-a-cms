import { registerCommand } from "../router"
import { existsSync } from "node:fs"
import { join } from "node:path"

registerCommand({
  name: "dev",
  description: "Start the development server",
  async run(args) {
    const port = args.find((a) => a.startsWith("--port="))?.split("=")[1]

    const configPath = join(process.cwd(), "not-a-cms.config.ts")
    if (!existsSync(configPath)) {
      console.error("No not-a-cms.config.ts found in current directory")
      console.error("Run 'not-a-cms init' to create a project first")
      process.exit(1)
    }

    console.log("Starting not-a-cms dev server...")

    try {
      // Dynamic import the user's config
      const config = await import(configPath)
      const userConfig = config.default

      // Import server dynamically (may not be in CLI's own deps)
      const { createServer } = await import("@not-a-cms/server")

      createServer({
        port: port ? parseInt(port) : userConfig.port ?? 4321,
        database: {
          url: userConfig.database?.url ?? "data.db",
        },
        auth: {
          secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-me-" + "x".repeat(16),
          baseURL: userConfig.site?.url ?? `http://localhost:${port || 4321}`,
          magicLink: {
            sendMagicLink: async ({ email, url }: { email: string; url: string }) => {
              console.log(`\n  Magic link for ${email}: ${url}\n`)
            },
          },
        },
        collections: userConfig.collections ?? [],
      })
    } catch (err: any) {
      console.error("Failed to start dev server:", err.message)
      process.exit(1)
    }
  },
})
