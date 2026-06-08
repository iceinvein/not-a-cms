import {
  type AppDatabase,
  type CollectionDef,
  extractMediaReferences,
  type MediaReference,
} from "@not-a-cms/core"
import { sql } from "drizzle-orm"

export type UsageReference = {
  collection: string
  documentId: string
  label: string
  field: string
}

// service.findMany() must return DESERIALIZED documents (media fields keyed by
// logical name, e.g. doc.cover), since extractMediaReferences reads logical names.
type RebuildEntry = {
  def: CollectionDef
  service: { findMany: () => Promise<Record<string, unknown>[]> }
}

export type MediaReferenceStoreOptions = {
  // When provided, references to assets that no longer exist are filtered out at
  // write/rebuild time so a deleted asset never re-enters the reverse index.
  assetExists?: (assetId: string) => boolean
}

export function createMediaReferenceStore(
  db: AppDatabase,
  options: MediaReferenceStoreOptions = {},
) {
  function replaceForDocument(
    collection: string,
    documentId: string,
    refs: MediaReference[],
  ): void {
    const live = options.assetExists
      ? refs.filter((ref) => options.assetExists!(ref.assetId))
      : refs
    // Atomic replace: the delete and the re-inserts run in one transaction so a
    // failed insert (or a crash mid-write) rolls back to the prior index rather
    // than leaving the document partially indexed until the next boot rebuild.
    db.transaction((tx) => {
      tx.run(
        sql`DELETE FROM media_references WHERE collection = ${collection} AND document_id = ${documentId}`,
      )
      for (const ref of live) {
        tx.run(sql`INSERT INTO media_references (asset_id, collection, document_id, field, label)
          VALUES (${ref.assetId}, ${collection}, ${documentId}, ${ref.field}, ${ref.label})`)
      }
    })
  }

  function removeDocument(collection: string, documentId: string): void {
    db.run(
      sql`DELETE FROM media_references WHERE collection = ${collection} AND document_id = ${documentId}`,
    )
  }

  function removeAsset(assetId: string): void {
    db.run(sql`DELETE FROM media_references WHERE asset_id = ${assetId}`)
  }

  function counts(): Record<string, number> {
    const rows =
      db.all(sql`SELECT asset_id AS assetId, COUNT(DISTINCT collection || ':' || document_id) AS n
      FROM media_references GROUP BY asset_id`) as { assetId: string; n: number }[]
    const out: Record<string, number> = {}
    for (const row of rows) out[String(row.assetId)] = Number(row.n)
    return out
  }

  function references(assetId: string): UsageReference[] {
    const rows = db.all(sql`SELECT collection, document_id, field, label
      FROM media_references WHERE asset_id = ${assetId}
      ORDER BY collection, document_id, field`) as {
      collection: string
      document_id: string
      field: string
      label: string
    }[]
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
  //
  // rebuild indexes whatever each service.findMany() returns. The server wires
  // findMany() with no status filter (packages/server/src/index.ts), so drafts are
  // indexed alongside published docs. This is intentional: the Vault surfaces media
  // usage for unpublished documents too, not only published ones.
  async function rebuild(collections: Map<string, RebuildEntry>): Promise<void> {
    clear()
    for (const [name, entry] of collections) {
      const docs = await entry.service.findMany()
      for (const doc of docs) {
        replaceForDocument(name, String(doc.id), extractMediaReferences(entry.def, doc))
      }
    }
  }

  return {
    replaceForDocument,
    removeDocument,
    removeAsset,
    counts,
    references,
    usage,
    clear,
    rebuild,
  }
}

export type MediaReferenceStore = ReturnType<typeof createMediaReferenceStore>
