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

export function createEmbeddingStore(db: any) {
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
        return
      }

      db.run(sql`INSERT INTO content_embeddings (collection, document_id, dim, vector, model, updated_at)
        VALUES (${collection}, ${documentId}, ${vector.length}, ${toBlob(vector)}, ${model}, ${updatedAt})
        ON CONFLICT(collection, document_id) DO UPDATE SET
          dim = excluded.dim,
          vector = excluded.vector,
          model = excluded.model,
          updated_at = excluded.updated_at`)
    },

    remove(collection: string, documentId: string): void {
      if (db.query) {
        run("DELETE FROM content_embeddings WHERE collection = ? AND document_id = ?", [collection, documentId])
        return
      }
      db.run(sql`DELETE FROM content_embeddings WHERE collection = ${collection} AND document_id = ${documentId}`)
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
