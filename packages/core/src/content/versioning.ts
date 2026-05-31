import { sql } from "drizzle-orm"
import type { AppDatabase } from "../db/connection"

type VersionRecord = {
  id: string
  collection: string
  document_id: string
  data: Record<string, unknown>
  version_number: number
  action: "save" | "publish"
  created_at: string
}

type VersionRow = Omit<VersionRecord, "data"> & { data: string }

export type VersionChange = {
  field: string
  before: unknown
  after: unknown
}

export function createVersioningService(db: AppDatabase) {
  function createVersion(
    collection: string,
    documentId: string,
    data: Record<string, unknown>,
    action: "save" | "publish",
  ): VersionRecord {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    type MaxResult = { max_v: number | null }
    const rows = db.all<MaxResult>(
      sql`SELECT MAX(version_number) as max_v FROM _versions WHERE collection = ${collection} AND document_id = ${documentId}`,
    )
    const maxV = (rows as MaxResult[])[0]?.max_v ?? 0
    const versionNumber = maxV + 1

    const dataJson = JSON.stringify(data)

    db.run(
      sql`INSERT INTO _versions (id, collection, document_id, data, version_number, action, created_at) VALUES (${id}, ${collection}, ${documentId}, ${dataJson}, ${versionNumber}, ${action}, ${now})`,
    )

    return { id, collection, document_id: documentId, data, version_number: versionNumber, action, created_at: now }
  }

  function listVersions(collection: string, documentId: string): VersionRecord[] {
    const rows = db.all<VersionRow>(
      sql`SELECT * FROM _versions WHERE collection = ${collection} AND document_id = ${documentId} ORDER BY version_number DESC`,
    )
    return (rows as VersionRow[]).map(parseVersionRow)
  }

  function getVersion(versionId: string): VersionRecord | null {
    const rows = db.all<VersionRow>(
      sql`SELECT * FROM _versions WHERE id = ${versionId}`,
    )
    const row = (rows as VersionRow[])[0]
    if (!row) return null
    return parseVersionRow(row)
  }

  return { createVersion, listVersions, getVersion }
}

export function compareVersionData(
  current: Record<string, unknown>,
  version: Record<string, unknown>,
): VersionChange[] {
  const ignored = new Set(["id", "created_at", "updated_at"])
  const fields = new Set([...Object.keys(current), ...Object.keys(version)])
  const changes: VersionChange[] = []

  for (const field of fields) {
    if (ignored.has(field)) continue
    const before = current[field]
    const after = version[field]
    if (JSON.stringify(before) === JSON.stringify(after)) continue
    changes.push({ field, before, after })
  }

  return changes
}

function parseVersionRow(row: VersionRow): VersionRecord {
  return {
    ...row,
    data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
  }
}

export type VersioningService = ReturnType<typeof createVersioningService>
export type { VersionRecord }
