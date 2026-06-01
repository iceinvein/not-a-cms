import { describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { createEmbeddingStore } from "../../src/content/embeddings"

function store() {
  const db = new Database(":memory:")
  db.run(`CREATE TABLE content_embeddings (
    collection TEXT NOT NULL,
    document_id TEXT NOT NULL,
    dim INTEGER NOT NULL,
    vector BLOB NOT NULL,
    model TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(collection, document_id)
  )`)
  return createEmbeddingStore(db as any)
}

describe("embedding store", () => {
  test("upsert and nearest-neighbour search rank by cosine", () => {
    const s = store()
    s.upsert("post", "a", new Float32Array([1, 0, 0]), "m")
    s.upsert("post", "b", new Float32Array([0, 1, 0]), "m")
    s.upsert("post", "c", new Float32Array([0.9, 0.1, 0]), "m")

    const hits = s.search(new Float32Array([1, 0, 0]), 2)

    expect(hits.map((h) => h.document_id)).toEqual(["a", "c"])
  })

  test("remove drops a row and collection filter scopes search", () => {
    const s = store()
    s.upsert("post", "a", new Float32Array([1, 0]), "m")
    s.upsert("page", "x", new Float32Array([1, 0]), "m")
    s.remove("post", "a")

    expect(s.search(new Float32Array([1, 0]), 5, "post")).toEqual([])
    expect(s.search(new Float32Array([1, 0]), 5, "page").map((h) => h.document_id)).toEqual(["x"])
  })
})
