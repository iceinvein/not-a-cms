import type { CollectionDef } from "../types"
import type { AppDatabase } from "./connection"
import { sql } from "drizzle-orm"

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

export function generateCreateTableSQL(collection: CollectionDef): string {
  const columns = getCollectionColumns(collection).map((column) => `${column.name} ${column.sqlType}${column.primaryKey ? " PRIMARY KEY" : ""}${column.required ? " NOT NULL" : ""}`)

  return `CREATE TABLE IF NOT EXISTS ${collection.name} (\n  ${columns.join(",\n  ")}\n);`
}

export type MigrationGenerationOptions = {
  db?: AppDatabase
  allowDestructive?: boolean
  includeSystemTables?: boolean
}

type ColumnDef = {
  name: string
  sqlType: "TEXT" | "INTEGER"
  primaryKey?: boolean
  required?: boolean
}

export function generateMigrationSQL(collections: CollectionDef[], options: MigrationGenerationOptions = {}): string {
  const parts: string[] = []

  for (const col of collections) {
    if (!options.db) {
      parts.push(generateCreateTableSQL(col))
      continue
    }

    const existingColumns = getExistingTableColumns(options.db, col.name)
    if (!existingColumns) {
      parts.push(generateCreateTableSQL(col))
      continue
    }

    const desiredColumns = getCollectionColumns(col)
    for (const column of desiredColumns) {
      if (existingColumns.has(column.name)) continue
      parts.push(`ALTER TABLE ${col.name} ADD COLUMN ${column.name} ${column.sqlType}${column.required ? " NOT NULL" : ""};`)
    }

    for (const existingColumn of existingColumns) {
      if (desiredColumns.some((column) => column.name === existingColumn)) continue
      const message = `Destructive change detected for ${col.name}.${existingColumn}: column exists in database but not in collection schema`
      if (!options.allowDestructive) {
        throw new Error(`${message}. Re-run with --allow-destructive to acknowledge and write a manual migration.`)
      }
      parts.push(`-- ${message}. SQLite destructive migrations must be written manually.`)
    }
  }

  if (options.db && options.includeSystemTables === false) {
    return parts.join("\n\n")
  }

  // System tables
  appendSystemMigrationSQL(parts, options.db)

  return parts.join("\n\n")
}

function getCollectionColumns(collection: CollectionDef): ColumnDef[] {
  const columns: ColumnDef[] = [
    { name: "id", sqlType: "TEXT", primaryKey: true },
    { name: "created_at", sqlType: "TEXT" },
    { name: "updated_at", sqlType: "TEXT" },
  ]

  for (const [name, fieldDef] of Object.entries(collection.fields)) {
    const colName = camelToSnake(name)
    const required = fieldDef.required

    switch (fieldDef.type) {
      case "number":
      case "boolean":
        columns.push({ name: colName, sqlType: "INTEGER", required })
        break
      case "relation":
      case "media":
        columns.push({ name: `${colName}_id`, sqlType: "TEXT", required })
        break
      default:
        columns.push({ name: colName, sqlType: "TEXT", required })
        break
    }
  }

  return columns
}

function appendSystemMigrationSQL(parts: string[], db?: AppDatabase) {
  if (!db || !tableExists(db, "_versions")) {
    parts.push(`CREATE TABLE IF NOT EXISTS _versions (
  id TEXT PRIMARY KEY,
  collection TEXT NOT NULL,
  document_id TEXT NOT NULL,
  data TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL
);`)
  }

  parts.push(`CREATE INDEX IF NOT EXISTS idx_versions_lookup ON _versions(collection, document_id, version_number DESC);`)

  if (!db || !tableExists(db, "content_fts")) {
    parts.push(`CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
  collection,
  document_id,
  title,
  body_text,
  tokenize='porter unicode61'
);`)
  }
}

function getExistingTableColumns(db: AppDatabase, tableName: string): Set<string> | null {
  if (!tableExists(db, tableName)) return null

  const rows = db.all<{ name: string }>(sql`${sql.raw(`PRAGMA table_info(${quoteIdentifier(tableName)})`)}`) as Array<{ name: string }>
  return new Set(rows.map((row) => row.name))
}

function tableExists(db: AppDatabase, tableName: string): boolean {
  const rows = db.all<{ name: string }>(
    sql`SELECT name FROM sqlite_master WHERE name = ${tableName} AND type IN ('table', 'view')`,
  ) as Array<{ name: string }>
  return rows.length > 0
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`
}
