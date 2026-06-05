import { sql } from "drizzle-orm"
import { cosine } from "../ai/cosine"

export type EmbeddingHit = {
  collection: string
  document_id: string
  score: number
}

type Row = {
  collection: string
  document_id: string
  vector: Uint8Array
  dim: number
}

const VEC_TABLE = "content_embeddings_vec"

export type EmbeddingStoreOptions = { vectorSearch?: boolean }

export function createEmbeddingStore(db: any, options: EmbeddingStoreOptions = {}) {
  const hasRaw = Boolean(db.query)
  const vectorSearch = Boolean(options.vectorSearch)
  let vecDim: number | null = null

  function toBlob(vec: Float32Array): Uint8Array {
    return new Uint8Array(vec.buffer.slice(vec.byteOffset, vec.byteOffset + vec.byteLength))
  }

  function fromBlob(blob: Uint8Array): Float32Array {
    return new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / Float32Array.BYTES_PER_ELEMENT)
  }

  function run(query: ReturnType<typeof sql> | string, params: unknown[] = []) {
    if (typeof query === "string") return db.query(query).run(...params)
    return db.run(query)
  }

  function all<T>(query: ReturnType<typeof sql> | string, params: unknown[] = []): T[] {
    if (typeof query === "string") return db.query(query).all(...params) as T[]
    return db.all(query) as T[]
  }

  // --- vec0 dual-path helpers ----------------------------------------------
  // Each operation supplies a raw-bun:sqlite form and a drizzle form, branching
  // on hasRaw (tests use a raw Database; the server uses drizzle).

  // Composite primary key for a (collection, documentId) pair. JSON-encoded so
  // distinct pairs never collide and the value contains no NUL byte (a NUL
  // truncates a SQLite TEXT key on readback, so a NUL separator is unsafe).
  function keyOf(collection: string, documentId: string): string {
    return JSON.stringify([collection, documentId])
  }

  function vrun(rawSql: string, drizzleSql: ReturnType<typeof sql>, params: unknown[] = []): void {
    if (hasRaw) { db.run(rawSql, params); return }
    db.run(drizzleSql)
  }

  function dropVec(): void {
    if (hasRaw) { db.run(`DROP TABLE IF EXISTS ${VEC_TABLE}`); return }
    db.run(sql`DROP TABLE IF EXISTS content_embeddings_vec`)
  }

  function createVec(dim: number): void {
    const ddl = `CREATE VIRTUAL TABLE IF NOT EXISTS ${VEC_TABLE} USING vec0(
      key text primary key,
      collection text partition key,
      +document_id text,
      embedding float[${dim}] distance_metric=cosine
    )`
    if (hasRaw) { db.run(ddl); return }
    db.run(sql.raw(ddl))
  }

  // Ensure the vec0 table exists at `dim`. A dim change (model swap) discards
  // the stale index; the only row of the new dim is the one being written.
  function ensureVec(dim: number): void {
    if (vecDim === dim) return
    if (vecDim !== null) dropVec()
    createVec(dim)
    vecDim = dim
  }

  function vecDelete(key: string): void {
    vrun(
      `DELETE FROM ${VEC_TABLE} WHERE key = ?`,
      sql`DELETE FROM content_embeddings_vec WHERE key = ${key}`,
      [key],
    )
  }

  function vecInsert(collection: string, documentId: string, blob: Uint8Array): void {
    const key = keyOf(collection, documentId)
    vecDelete(key)
    vrun(
      `INSERT INTO ${VEC_TABLE}(key, collection, document_id, embedding) VALUES (?, ?, ?, ?)`,
      sql`INSERT INTO content_embeddings_vec(key, collection, document_id, embedding)
          VALUES (${key}, ${collection}, ${documentId}, ${blob})`,
      [key, collection, documentId, blob],
    )
  }

  return {
    upsert(collection: string, documentId: string, vector: Float32Array, model: string): void {
      const updatedAt = new Date().toISOString()
      if (db.query) {
        run(
          `INSERT INTO content_embeddings (collection, document_id, dim, vector, model, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(collection, document_id) DO UPDATE SET
             dim = excluded.dim,
             vector = excluded.vector,
             model = excluded.model,
             updated_at = excluded.updated_at`,
          [collection, documentId, vector.length, toBlob(vector), model, updatedAt],
        )
      } else {
        db.run(sql`INSERT INTO content_embeddings (collection, document_id, dim, vector, model, updated_at)
          VALUES (${collection}, ${documentId}, ${vector.length}, ${toBlob(vector)}, ${model}, ${updatedAt})
          ON CONFLICT(collection, document_id) DO UPDATE SET
            dim = excluded.dim,
            vector = excluded.vector,
            model = excluded.model,
            updated_at = excluded.updated_at`)
      }

      if (vectorSearch) {
        try {
          ensureVec(vector.length)
          vecInsert(collection, documentId, toBlob(vector))
        } catch {
          // Derived-index drift only; the authoritative write above succeeded
          // and the next boot rebuild reconciles.
        }
      }
    },

    remove(collection: string, documentId: string): void {
      if (db.query) {
        run("DELETE FROM content_embeddings WHERE collection = ? AND document_id = ?", [collection, documentId])
      } else {
        db.run(sql`DELETE FROM content_embeddings WHERE collection = ${collection} AND document_id = ${documentId}`)
      }

      if (vectorSearch && vecDim !== null) {
        try {
          vecDelete(keyOf(collection, documentId))
        } catch {
          // see upsert: derived-index drift heals on rebuild
        }
      }
    },

    search(query: Float32Array, k: number, collection?: string): EmbeddingHit[] {
      const rows: Row[] = collection
        ? db.query
          ? all<Row>("SELECT collection, document_id, vector, dim FROM content_embeddings WHERE collection = ?", [collection])
          : db.all(sql`SELECT collection, document_id, vector, dim FROM content_embeddings WHERE collection = ${collection}`) as Row[]
        : db.query
          ? all<Row>("SELECT collection, document_id, vector, dim FROM content_embeddings")
          : db.all(sql`SELECT collection, document_id, vector, dim FROM content_embeddings`) as Row[]

      return rows
        .filter((row) => row.dim === query.length)
        .map((row) => ({
          collection: row.collection,
          document_id: row.document_id,
          score: cosine(query, fromBlob(row.vector)),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
    },
  }
}

export type EmbeddingStore = ReturnType<typeof createEmbeddingStore>
