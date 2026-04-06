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

export function createVersioningService(db: AppDatabase) {
  function createVersion(
    collection: string,
    documentId: string,
    data: Record<string, unknown>,
    action: "save" | "publish",
  ): VersionRecord {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const rows = db.all<{ max_v: number | null }>(
      sql`SELECT MAX(version_number) as max_v FROM _versions WHERE collection = ${collection} AND document_id = ${documentId}`,
    )
    const maxV = (rows[0] as any)?.max_v ?? 0
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
    return (rows as any[]).map(parseVersionRow)
  }

  function getVersion(versionId: string): VersionRecord | null {
    const rows = db.all<VersionRow>(
      sql`SELECT * FROM _versions WHERE id = ${versionId}`,
    )
    const row = (rows as any[])[0]
    if (!row) return null
    return parseVersionRow(row)
  }

  return { createVersion, listVersions, getVersion }
}

function parseVersionRow(row: any): VersionRecord {
  return {
    ...row,
    data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
  }
}

export type VersioningService = ReturnType<typeof createVersioningService>
export type { VersionRecord }
