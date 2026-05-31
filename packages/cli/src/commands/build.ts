import { registerCommand } from "../router"
import { loadConfig, resolveConfigPath } from "@not-a-cms/core"

registerCommand({
  name: "build",
  description: "Build for production",
  async run(args) {
    console.log("Building not-a-cms for production...\n")

    const isStatic = args.includes("--static")

    try {
      await loadConfig({ cwd: process.cwd() })
      const configPath = resolveConfigPath({ cwd: process.cwd() })

      // Build the server bundle
      console.log("  Building server...")
      const serverResult = await Bun.build({
        entrypoints: [configPath],
        outdir: "./dist",
        target: "bun",
        minify: true,
      })

      if (!serverResult.success) {
        console.error("Server build failed:")
        for (const log of serverResult.logs) {
          console.error("  ", log)
        }
        process.exit(1)
      }

      console.log("  Server built → ./dist/")

      if (isStatic) {
        console.log("  Static export mode — pre-rendering all pages...")
        console.log("  (Static site generation will be available in a future update)")
      }

      console.log("\nBuild complete!")
      console.log("\nTo start production server:")
      console.log("  bun ./dist/not-a-cms.config.js")
    } catch (err: any) {
      console.error("Build failed:", err.message)
      process.exit(1)
    }
  },
})
