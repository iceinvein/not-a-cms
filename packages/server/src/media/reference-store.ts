import { sql } from "drizzle-orm"
import { extractMediaReferences, type MediaReference, type CollectionDef, type AppDatabase } from "@not-a-cms/core"

export type UsageReference = { collection: string; documentId: string; label: string; field: string }

// service.findMany() must return DESERIALIZED documents (media fields keyed by
// logical name, e.g. doc.cover), since extractMediaReferences reads logical names.
type RebuildEntry = { def: CollectionDef; service: { findMany: () => Promise<Record<string, unknown>[]> } }

export function createMediaReferenceStore(db: AppDatabase) {
  function replaceForDocument(collection: string, documentId: string, refs: MediaReference[]): void {
    db.run(sql`DELETE FROM media_references WHERE collection = ${collection} AND document_id = ${documentId}`)
    for (const ref of refs) {
      db.run(sql`INSERT INTO media_references (asset_id, collection, document_id, field, label)
        VALUES (${ref.assetId}, ${collection}, ${documentId}, ${ref.field}, ${ref.label})`)
    }
  }

  function removeDocument(collection: string, documentId: string): void {
    db.run(sql`DELETE FROM media_references WHERE collection = ${collection} AND document_id = ${documentId}`)
  }

  function counts(): Record<string, number> {
    const rows = db.all(sql`SELECT asset_id AS assetId, COUNT(DISTINCT collection || ':' || document_id) AS n
      FROM media_references GROUP BY asset_id`) as { assetId: string; n: number }[]
    const out: Record<string, number> = {}
    for (const row of rows) out[String(row.assetId)] = Number(row.n)
    return out
  }

  function references(assetId: string): UsageReference[] {
    const rows = db.all(sql`SELECT collection, document_id, field, label
      FROM media_references WHERE asset_id = ${assetId}
      ORDER BY collection, document_id, field`) as { collection: string; document_id: string; field: string; label: string }[]
    return rows.map((row) => ({
      collection: row.collection,
      documentId: String(row.document_id),
      field: row.field,
      label: row.label,
    }))
  }

  function usage(assetId: string): { count: number; references: UsageReference[] } {
    const refs = references(assetId)
    const docs = new Set(refs.map((r) => `${r.collection}:${r.documentId}`))
    return { count: docs.size, references: refs }
  }

  function clear(): void {
    db.run(sql`DELETE FROM media_references`)
  }

  // Callers may observe empty/partial counts between clear() and completion;
  // acceptable for a derived index that also updates incrementally on writes.
  async function rebuild(collections: Map<string, RebuildEntry>): Promise<void> {
    clear()
    for (const [name, entry] of collections) {
      const docs = await entry.service.findMany()
      for (const doc of docs) {
        replaceForDocument(name, String(doc.id), extractMediaReferences(entry.def, doc))
      }
    }
  }

  return { replaceForDocument, removeDocument, counts, references, usage, clear, rebuild }
}

export type MediaReferenceStore = ReturnType<typeof createMediaReferenceStore>
