import { describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import * as sqliteVec from "sqlite-vec"
import { createEmbeddingStore } from "../../src/content/embeddings"

const MAC_SQLITE = "/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib"

// Establish custom SQLite (process-global) and probe load FIRST in this file.
function canLoad(): boolean {
  try {
    if (process.platform === "darwin") Database.setCustomSQLite(MAC_SQLITE)
    const probe = new Database(":memory:")
    sqliteVec.load(probe)
    probe.close()
    return true
  } catch {
    return false
  }
}
const OK = canLoad()

function makeStore() {
  const db = new Database(":memory:")
  sqliteVec.load(db)
  db.run(`CREATE TABLE content_embeddings (
    collection TEXT NOT NULL, document_id TEXT NOT NULL, dim INTEGER NOT NULL,
    vector BLOB NOT NULL, model TEXT NOT NULL, updated_at TEXT NOT NULL,
    PRIMARY KEY(collection, document_id))`)
  const store = createEmbeddingStore(db as any, { vectorSearch: true })
  return { db, store }
}

const vecCount = (db: Database) =>
  (db.query("SELECT count(*) AS c FROM content_embeddings_vec").get() as any).c

describe("embedding store vec0 write path", () => {
  test.skipIf(!OK)("upsert writes a vec0 row and content_embeddings row", () => {
    const { db, store } = makeStore()
    store.upsert("post", "a", new Float32Array([1, 0, 0]), "m")
    expect(vecCount(db)).toBe(1)
    expect((db.query("SELECT count(*) AS c FROM content_embeddings").get() as any).c).toBe(1)
  })

  test.skipIf(!OK)("upsert is idempotent on the vec0 index", () => {
    const { db, store } = makeStore()
    store.upsert("post", "a", new Float32Array([1, 0, 0]), "m")
    store.upsert("post", "a", new Float32Array([0, 1, 0]), "m")
    expect(vecCount(db)).toBe(1)
  })

  test.skipIf(!OK)("remove deletes the vec0 row", () => {
    const { db, store } = makeStore()
    store.upsert("post", "a", new Float32Array([1, 0, 0]), "m")
    store.remove("post", "a")
    expect(vecCount(db)).toBe(0)
  })

  test.skipIf(!OK)("changing the vector dimension recreates the index", () => {
    const { db, store } = makeStore()
    store.upsert("post", "a", new Float32Array([1, 0, 0]), "m")
    store.upsert("post", "a", new Float32Array([1, 0, 0, 0]), "m2")
    // table now declares float[4]; only the dim-4 row is present
    expect(vecCount(db)).toBe(1)
    const ddl = (db.query("SELECT sql FROM sqlite_master WHERE name = 'content_embeddings_vec'").get() as any).sql
    expect(ddl).toContain("float[4]")
  })
})
