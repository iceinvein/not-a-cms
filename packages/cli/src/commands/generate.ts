import { registerCommand } from "../router"
import { existsSync, writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"

registerCommand({
  name: "generate",
  description: "Generate types and migrations",
  async run(args) {
    const subcommand = args[0]

    if (subcommand === "types") {
      console.log("Types are auto-generated from your schema at runtime.")
      console.log("No separate type generation step needed with TypeScript-first schemas.")
      return
    }

    if (subcommand === "migration") {
      const migrationName = args[1] || "schema"
      const configPath = join(process.cwd(), "not-a-cms.config.ts")

      if (!existsSync(configPath)) {
        console.error("No not-a-cms.config.ts found in current directory")
        process.exit(1)
      }

      try {
        const config = await import(configPath)
        const collections = config.default?.collections ?? []

        if (collections.length === 0) {
          console.error("No collections defined in config")
          process.exit(1)
        }

        const { generateMigrationSQL } = await import("@not-a-cms/core")
        const sql = generateMigrationSQL(collections)

        const migrationsDir = join(process.cwd(), "migrations")
        mkdirSync(migrationsDir, { recursive: true })

        const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)
        const filename = `${timestamp}_${migrationName}.sql`
        const filepath = join(migrationsDir, filename)

        writeFileSync(filepath, sql)
        console.log(`Created migration: migrations/${filename}`)
        console.log(`Run 'not-a-cms migrate' to apply it.`)
      } catch (err: any) {
        console.error("Failed to generate migration:", err.message)
        process.exit(1)
      }
      return
    }

    console.log(`
  Usage: not-a-cms generate <subcommand>

  Subcommands:
    types           Show schema type info (types are auto-generated at runtime)
    migration [name]  Generate a SQL migration from current schema
`)
  },
})
