import { sql } from "drizzle-orm"
import type { AppDatabase } from "./connection"
import type { CollectionDef } from "../types"

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

export function bootstrapTables(db: AppDatabase, collections: CollectionDef[]) {
  for (const collection of collections) {
    const columns: string[] = [
      "id TEXT PRIMARY KEY",
      "created_at TEXT",
      "updated_at TEXT",
    ]

    for (const [name, fieldDef] of Object.entries(collection.fields)) {
      const colName = camelToSnake(name)
      const notNull = fieldDef.required ? " NOT NULL" : ""

      switch (fieldDef.type) {
        case "number":
        case "boolean":
          columns.push(`${colName} INTEGER${notNull}`)
          break
        case "relation":
        case "media":
          columns.push(`${colName}_id TEXT${notNull}`)
          break
        default:
          columns.push(`${colName} TEXT${notNull}`)
          break
      }
    }

    db.run(sql`${sql.raw(`CREATE TABLE IF NOT EXISTS ${collection.name} (${columns.join(", ")})`)}`)

    // Check for missing columns and add them (handles schema evolution on existing DBs)
    const existingCols = db.all(sql`${sql.raw(`PRAGMA table_info(${collection.name})`)}`) as Array<{ name: string }>
    const existingColNames = new Set(existingCols.map(c => c.name))

    for (const [name, fieldDef] of Object.entries(collection.fields)) {
      const colName = camelToSnake(name)
      const effectiveName = (fieldDef.type === "relation" || fieldDef.type === "media") ? `${colName}_id` : colName
      if (existingColNames.has(effectiveName)) continue

      let colType = "TEXT"
      if (fieldDef.type === "number" || fieldDef.type === "boolean") colType = "INTEGER"

      db.run(sql`${sql.raw(`ALTER TABLE ${collection.name} ADD COLUMN ${effectiveName} ${colType}`)}`)
    }
  }

  db.run(sql`${sql.raw(`CREATE TABLE IF NOT EXISTS _versions (
    id TEXT PRIMARY KEY,
    collection TEXT NOT NULL,
    document_id TEXT NOT NULL,
    data TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    action TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`)}`)

  db.run(sql`${sql.raw(
    `CREATE INDEX IF NOT EXISTS idx_versions_lookup ON _versions(collection, document_id, version_number DESC)`
  )}`)

  db.run(sql`${sql.raw(`CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
    collection,
    document_id,
    title,
    body_text,
    tokenize='porter unicode61'
  )`)}`)

  db.run(sql`${sql.raw(`CREATE TABLE IF NOT EXISTS _webhooks (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    events TEXT NOT NULL,
    collection TEXT,
    secret TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`)}`)

  db.run(sql`${sql.raw(`CREATE TABLE IF NOT EXISTS _webhook_logs (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    event TEXT NOT NULL,
    status INTEGER NOT NULL,
    request_body TEXT NOT NULL,
    response_body TEXT,
    attempts INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`)}`)

  db.run(sql`${sql.raw(`CREATE TABLE IF NOT EXISTS _preview_tokens (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    collection TEXT NOT NULL,
    document_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`)}`)

  db.run(sql`${sql.raw(`CREATE TABLE IF NOT EXISTS _settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`)}`)

  db.run(sql`${sql.raw(`CREATE TABLE IF NOT EXISTS _flows (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, trigger TEXT NOT NULL, steps TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`)}`)

  db.run(sql`${sql.raw(`CREATE TABLE IF NOT EXISTS _flow_runs (id TEXT PRIMARY KEY, flow_id TEXT NOT NULL REFERENCES _flows(id) ON DELETE CASCADE, trigger_event TEXT NOT NULL, trigger_payload TEXT, status TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT, error TEXT)`)}`)

  db.run(sql`${sql.raw(`CREATE INDEX IF NOT EXISTS idx_flow_runs_flow_id ON _flow_runs(flow_id, started_at DESC)`)}`)

  db.run(sql`${sql.raw(`CREATE TABLE IF NOT EXISTS _flow_run_steps (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES _flow_runs(id) ON DELETE CASCADE, step_id TEXT NOT NULL, status TEXT NOT NULL, input TEXT, output TEXT, branch_taken TEXT, started_at TEXT NOT NULL, finished_at TEXT, error TEXT)`)}`)

  db.run(sql`${sql.raw(`CREATE INDEX IF NOT EXISTS idx_flow_run_steps_run_id ON _flow_run_steps(run_id)`)}`)
}
