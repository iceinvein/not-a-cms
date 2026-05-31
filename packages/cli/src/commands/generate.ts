import { registerCommand } from "../router"
import { writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { createDatabase, generateMigrationSQL, loadConfig, type CMSConfig } from "@not-a-cms/core"

type MigrationStatus = {
  applied: string[]
  pending: string[]
}

type GenerateMigrationFileOptions = {
  cwd: string
  name: string
  now?: Date
  allowDestructive?: boolean
  config?: CMSConfig
}

export function createMigrationFilename(name: string, now = new Date()): string {
  const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14)
  const safeName = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "schema"
  return `${timestamp}_${safeName}.sql`
}

export async function generateMigrationFile(options: GenerateMigrationFileOptions) {
  const userConfig = options.config ?? await loadConfig({ cwd: options.cwd })
  const collections = userConfig.collections ?? []

  if (collections.length === 0) {
    throw new Error("No collections defined in config")
  }

  const db = createDatabase({ url: userConfig.database?.url ?? "data.db" })
  const sql = generateMigrationSQL(collections, {
    db,
    allowDestructive: options.allowDestructive,
  })

  const migrationsDir = join(options.cwd, "migrations")
  mkdirSync(migrationsDir, { recursive: true })

  const filename = createMigrationFilename(options.name, options.now)
  const filepath = join(migrationsDir, filename)

  writeFileSync(filepath, sql.trim() + "\n")

  return { filename, filepath, sql }
}

export function formatMigrationStatus(dbUrl: string, status: MigrationStatus): string {
  const lines = [
    `Database: ${dbUrl}`,
    `Applied: ${status.applied.length}`,
    ...status.applied.map((name) => `  [applied] ${name}`),
    `Pending: ${status.pending.length}`,
    ...status.pending.map((name) => `  [pending] ${name}`),
  ]
  return lines.join("\n")
}

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
      const allowDestructive = args.includes("--allow-destructive")
      const migrationName = args.find((arg, index) => index > 0 && !arg.startsWith("--")) || "schema"

      try {
        const result = await generateMigrationFile({
          cwd: process.cwd(),
          name: migrationName,
          allowDestructive,
        })

        console.log(`Created migration: migrations/${result.filename}`)
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
