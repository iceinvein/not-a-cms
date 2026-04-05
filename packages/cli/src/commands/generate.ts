import { registerCommand } from "../router"
import { existsSync } from "node:fs"
import { join } from "node:path"

registerCommand({
  name: "generate",
  description: "Generate types and migrations",
  async run(args) {
    const subcommand = args[0]

    if (subcommand === "types") {
      console.log("Generating TypeScript types from schema...")

      const configPath = join(process.cwd(), "not-a-cms.config.ts")
      if (!existsSync(configPath)) {
        console.error("No not-a-cms.config.ts found")
        process.exit(1)
      }

      try {
        const config = await import(configPath)
        const collections = config.default?.collections ?? []

        console.log(`Found ${collections.length} collection(s):`)
        for (const col of collections) {
          console.log(`  - ${col.name} (${Object.keys(col.fields).length} fields)`)
        }
        console.log("\nTypes are auto-generated from your schema at runtime.")
        console.log("No separate type generation step needed with TypeScript-first schemas.")
      } catch (err: any) {
        console.error("Failed to load config:", err.message)
        process.exit(1)
      }
    } else if (subcommand === "migration") {
      console.log("Generating migration from schema changes...")
      console.log("\nRun: bunx drizzle-kit generate")
      console.log("Then: not-a-cms migrate")
    } else {
      console.log(`
  Usage: not-a-cms generate <subcommand>

  Subcommands:
    types       Show schema type info (types are auto-generated at runtime)
    migration   Generate a SQL migration from schema changes
`)
    }
  },
})
