import { sql } from "drizzle-orm"
import type { AppDatabase } from "../db/connection"

export function createSettingsService(db: AppDatabase) {
  function get(key: string): string | null {
    const rows = db.all(sql`SELECT value FROM _settings WHERE key = ${key}`) as any[]
    return rows[0]?.value ?? null
  }

  function getAll(prefix?: string): Record<string, string> {
    const rows = prefix
      ? db.all(sql`SELECT key, value FROM _settings WHERE key LIKE ${prefix + "%"}`) as any[]
      : db.all(sql`SELECT key, value FROM _settings`) as any[]
    const result: Record<string, string> = {}
    for (const row of rows) result[row.key] = row.value
    return result
  }

  function set(key: string, value: string): void {
    const now = new Date().toISOString()
    db.run(sql`INSERT INTO _settings (key, value, updated_at) VALUES (${key}, ${value}, ${now}) ON CONFLICT(key) DO UPDATE SET value = ${value}, updated_at = ${now}`)
  }

  function remove(key: string): void {
    db.run(sql`DELETE FROM _settings WHERE key = ${key}`)
  }

  return { get, getAll, set, remove }
}

export type SettingsService = ReturnType<typeof createSettingsService>
