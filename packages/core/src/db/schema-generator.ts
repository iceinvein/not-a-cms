import type { CollectionDef } from "../types"

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

export function generateCreateTableSQL(collection: CollectionDef): string {
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

  return `CREATE TABLE IF NOT EXISTS ${collection.name} (\n  ${columns.join(",\n  ")}\n);`
}

export function generateMigrationSQL(collections: CollectionDef[]): string {
  const parts: string[] = []

  for (const col of collections) {
    parts.push(generateCreateTableSQL(col))
  }

  // System tables
  parts.push(`CREATE TABLE IF NOT EXISTS _versions (
  id TEXT PRIMARY KEY,
  collection TEXT NOT NULL,
  document_id TEXT NOT NULL,
  data TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL
);`)

  parts.push(`CREATE INDEX IF NOT EXISTS idx_versions_lookup ON _versions(collection, document_id, version_number DESC);`)

  parts.push(`CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
  collection,
  document_id,
  title,
  body_text,
  tokenize='porter unicode61'
);`)

  return parts.join("\n\n")
}
