import { sql } from "drizzle-orm"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { AppDatabase } from "./connection"

type MigrationStatus = {
  applied: string[]
  pending: string[]
}

type RunResult = {
  applied: string[]
}

export function createMigrator(db: AppDatabase, migrationsDir: string) {
  function init() {
    db.run(sql`${sql.raw(`CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    )`)}`)
  }

  function getApplied(): string[] {
    const rows = db.all<{ name: string }>(
      sql`SELECT name FROM _migrations ORDER BY id ASC`,
    )
    return (rows as { name: string }[]).map((r) => r.name)
  }

  function getPending(): string[] {
    const applied = new Set(getApplied())
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
    return files.filter((f) => !applied.has(f))
  }

  function status(): MigrationStatus {
    return {
      applied: getApplied(),
      pending: getPending(),
    }
  }

  function run(): RunResult {
    const pending = getPending()
    const applied: string[] = []

    for (const filename of pending) {
      const filePath = join(migrationsDir, filename)
      const sqlContent = readFileSync(filePath, "utf-8").trim()

      if (sqlContent) {
        const statements = sqlContent
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean)

        for (const stmt of statements) {
          db.run(sql`${sql.raw(stmt)}`)
        }
      }

      const now = new Date().toISOString()
      db.run(
        sql`INSERT INTO _migrations (name, applied_at) VALUES (${filename}, ${now})`,
      )
      applied.push(filename)
    }

    return { applied }
  }

  return { init, status, run }
}

export type Migrator = ReturnType<typeof createMigrator>
