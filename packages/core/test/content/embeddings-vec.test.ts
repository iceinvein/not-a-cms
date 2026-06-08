import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
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
    const ddl = (
      db.query("SELECT sql FROM sqlite_master WHERE name = 'content_embeddings_vec'").get() as any
    ).sql
    expect(ddl).toContain("float[4]")
  })

  test.skipIf(!OK)("search reads from the vec0 index, not from content_embeddings", () => {
    const { db, store } = makeStore()
    store.upsert("post", "a", new Float32Array([1, 0, 0]), "m")
    store.upsert("post", "b", new Float32Array([0, 1, 0]), "m")
    // Wipe the BLOB table: the JS cosine fallback would now find nothing.
    db.run("DELETE FROM content_embeddings")
    const hits = store.search(new Float32Array([1, 0, 0]), 1)
    expect(hits.map((h) => h.document_id)).toEqual(["a"]) // only vec0 still holds the data
  })

  test.skipIf(!OK)("vec0 search ranks neighbours by cosine, best score first", () => {
    const { store } = makeStore()
    store.upsert("post", "a", new Float32Array([1, 0, 0]), "m")
    store.upsert("post", "b", new Float32Array([0, 1, 0]), "m")
    store.upsert("post", "c", new Float32Array([0.9, 0.1, 0]), "m")
    const hits = store.search(new Float32Array([1, 0, 0]), 2)
    expect(hits.map((h) => h.document_id)).toEqual(["a", "c"])
    expect(hits[0].score).toBeGreaterThan(hits[1].score)
  })

  test.skipIf(!OK)("collection filter scopes the vec0 search", () => {
    const { store } = makeStore()
    store.upsert("post", "a", new Float32Array([1, 0]), "m")
    store.upsert("page", "x", new Float32Array([1, 0]), "m")
    const hits = store.search(new Float32Array([1, 0]), 5, "page")
    expect(hits.map((h) => h.document_id)).toEqual(["x"])
  })

  test.skipIf(!OK)("a query whose dimension differs from the index falls back to JS cosine", () => {
    const { store } = makeStore()
    store.upsert("post", "a", new Float32Array([1, 0, 0]), "m") // index is float[3]
    // a dim-2 query: vecDim (3) !== 2, so JS cosine runs and filters by dim -> []
    expect(store.search(new Float32Array([1, 0]), 5)).toEqual([])
  })

  test.skipIf(!OK)("rebuild populates vec0 from content_embeddings", () => {
    const db = new Database(":memory:")
    sqliteVec.load(db)
    db.run(`CREATE TABLE content_embeddings (
      collection TEXT NOT NULL, document_id TEXT NOT NULL, dim INTEGER NOT NULL,
      vector BLOB NOT NULL, model TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY(collection, document_id))`)
    const blob = (v: number[]) => new Uint8Array(new Float32Array(v).buffer)
    db.run("INSERT INTO content_embeddings VALUES (?,?,?,?,?,?)", [
      "post",
      "a",
      3,
      blob([1, 0, 0]),
      "m",
      "2026-01-01",
    ])
    db.run("INSERT INTO content_embeddings VALUES (?,?,?,?,?,?)", [
      "post",
      "b",
      3,
      blob([0, 1, 0]),
      "m",
      "2026-01-01",
    ])

    const store = createEmbeddingStore(db as any, { vectorSearch: true })
    // before rebuild there is no vec0 table; search falls back to JS (still correct)
    store.rebuild()

    expect((db.query("SELECT count(*) AS c FROM content_embeddings_vec").get() as any).c).toBe(2)
    const hits = store.search(new Float32Array([1, 0, 0]), 1)
    expect(hits[0].document_id).toBe("a")
  })

  test.skipIf(!OK)("rebuild is a no-op when content_embeddings is empty", () => {
    const { store, db } = makeStore()
    store.rebuild()
    // no rows -> no vec0 table created
    const exists = db
      .query("SELECT name FROM sqlite_master WHERE name = 'content_embeddings_vec'")
      .get()
    expect(exists).toBeNull()
  })
})
