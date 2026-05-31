import { registerCommand } from "../router"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { createDatabase, createMigrator, loadConfig } from "@not-a-cms/core"
import { formatMigrationStatus } from "./generate"

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

    const migrationsDir = join(process.cwd(), "migrations")
    if (!existsSync(migrationsDir)) {
      console.error("No migrations/ directory found. Run 'not-a-cms generate migration' first.")
      process.exit(1)
    }

    try {
      const config = await loadConfig({ cwd: process.cwd() })
      const dbUrl = config.database?.url ?? "data.db"

      const db = createDatabase({ url: dbUrl })
      const migrator = createMigrator(db, migrationsDir)
      migrator.init()

      switch (subcommand) {
        case "run": {
          const status = migrator.status()
          if (status.pending.length === 0) {
            console.log("No pending migrations.")
            return
          }

          console.log(`Applying ${status.pending.length} migration(s)...`)
          const result = migrator.run()
          for (const name of result.applied) {
            console.log(`  Applied: ${name}`)
          }
          console.log("Done.")
          break
        }

        case "status": {
          const status = migrator.status()
          console.log(formatMigrationStatus(dbUrl, status))
          break
        }

        default:
          console.log(`
  Usage: not-a-cms migrate [subcommand]

  Subcommands:
    run         Apply pending migrations (default)
    status      Show migration status
`)
      }
    } catch (err: any) {
      console.error("Migration failed:", err.message)
      process.exit(1)
    }
  },
})
