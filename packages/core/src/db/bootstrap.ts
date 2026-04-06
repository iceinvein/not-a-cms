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
}
