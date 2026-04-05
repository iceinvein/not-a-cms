import { registerCommand } from "../router"
import { existsSync } from "node:fs"
import { join } from "node:path"

registerCommand({
  name: "migrate",
  description: "Run database migrations",
  async run(args) {
    const subcommand = args[0] || "run"

    const configPath = join(process.cwd(), "not-a-cms.config.ts")
    if (!existsSync(configPath)) {
      console.error("No not-a-cms.config.ts found")
      process.exit(1)
    }

    try {
      const config = await import(configPath)
      const dbUrl = config.default?.database?.url ?? "data.db"

      switch (subcommand) {
        case "run": {
          console.log(`Running migrations on ${dbUrl}...`)

          const { createDatabase, bootstrapTables } = await import("@not-a-cms/core")
          const db = createDatabase({ url: dbUrl })
          const collections = config.default?.collections ?? []

          bootstrapTables(db, collections)
          console.log(`Bootstrapped ${collections.length} table(s)`)
          console.log("Done.")
          break
        }

        case "status": {
          console.log(`Database: ${dbUrl}`)
          console.log(`Checking migration status...`)
          if (existsSync(dbUrl)) {
            console.log("Database file exists")
          } else {
            console.log("No database file yet — will be created on first run")
          }
          break
        }

        case "rollback": {
          console.log("Rollback is not yet supported.")
          console.log("Restore from a database backup instead.")
          break
        }

        default:
          console.log(`
  Usage: not-a-cms migrate [subcommand]

  Subcommands:
    run         Run pending migrations (default)
    status      Show migration status
    rollback    Revert last migration (not yet supported)
`)
      }
    } catch (err: any) {
      console.error("Migration failed:", err.message)
      process.exit(1)
    }
  },
})
