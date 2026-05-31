import { drizzle } from "drizzle-orm/bun-sqlite"
import { Database } from "bun:sqlite"

export type DatabaseConfig = { url: string }

export function createDatabase(config: DatabaseConfig) {
  const sqlite = new Database(config.url)
  sqlite.exec("PRAGMA journal_mode = WAL")
  sqlite.exec("PRAGMA foreign_keys = ON")
  const db = drizzle({ client: sqlite })

  // drizzle's get() uses stmt.values() which returns arrays; override to return objects
  const originalAll = db.all.bind(db)
  type GetQuery = Parameters<typeof db.get>[0]
  ;(db as any).get = function <T>(query: GetQuery): T | undefined {
    const results = originalAll(query) as T[]
    return results[0]
  }

  return db
}

export type AppDatabase = ReturnType<typeof createDatabase>
