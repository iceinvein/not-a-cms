import { Database } from "bun:sqlite"
import { existsSync } from "node:fs"
import { drizzle } from "drizzle-orm/bun-sqlite"
import * as sqliteVec from "sqlite-vec"

export type DatabaseConfig = {
  url: string
  vectorSearch?: { enabled?: boolean; sqlitePath?: string }
}

// macOS disables extension loading in Apple's SQLite; point bun:sqlite at an
// extension-capable build (Homebrew's) before any Database is opened.
const MACOS_SQLITE_CANDIDATES = [
  "/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib",
  "/usr/local/opt/sqlite/lib/libsqlite3.dylib",
]

let customSqliteAttempted = false

function ensureCustomSqlite(sqlitePath?: string): void {
  if (process.platform !== "darwin") return
  if (customSqliteAttempted) return
  customSqliteAttempted = true
  const candidates = sqlitePath ? [sqlitePath, ...MACOS_SQLITE_CANDIDATES] : MACOS_SQLITE_CANDIDATES
  const found = candidates.find((p) => existsSync(p))
  if (!found) return
  try {
    Database.setCustomSQLite(found)
  } catch {
    // A Database may already be open in this process; the load below will then
    // fail and we fall back to the JS cosine path.
  }
}

export function createDatabase(config: DatabaseConfig) {
  let vectorSearchEnabled = false

  if (config.vectorSearch?.enabled) {
    ensureCustomSqlite(config.vectorSearch.sqlitePath)
  }

  const sqlite = new Database(config.url)
  sqlite.exec("PRAGMA journal_mode = WAL")
  sqlite.exec("PRAGMA foreign_keys = ON")

  if (config.vectorSearch?.enabled) {
    try {
      sqliteVec.load(sqlite)
      vectorSearchEnabled = true
    } catch {
      vectorSearchEnabled = false
    }
  }

  const db = drizzle({ client: sqlite })

  // drizzle's get() uses stmt.values() which returns arrays; override to return objects
  const originalAll = db.all.bind(db)
  type GetQuery = Parameters<typeof db.get>[0]
  ;(db as any).get = <T>(query: GetQuery): T | undefined => {
    const results = originalAll(query) as T[]
    return results[0]
  }
  ;(db as any).vectorSearchEnabled = vectorSearchEnabled

  return db
}

export type AppDatabase = ReturnType<typeof createDatabase>

export function isVectorSearchEnabled(db: AppDatabase): boolean {
  return Boolean((db as any).vectorSearchEnabled)
}
