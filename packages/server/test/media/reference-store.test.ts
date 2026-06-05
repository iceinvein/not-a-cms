import { afterEach, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import { createDatabase, bootstrapTables, defineCollection, field } from "@not-a-cms/core"
import { createMediaReferenceStore } from "../../src/media/reference-store"

const testDbPath = "test-media-ref-store.db"

const post = defineCollection({
  name: "post",
  fields: { title: field.text({ required: true }), cover: field.media({ accept: ["image/*"] }) },
})

afterEach(() => {
  for (const suffix of ["", "-wal", "-shm"]) { try { unlinkSync(testDbPath + suffix) } catch {} }
})

function setup() {
  const db = createDatabase({ url: testDbPath })
  bootstrapTables(db, [])
  return { db, store: createMediaReferenceStore(db) }
}

describe("createMediaReferenceStore", () => {
  test("replaceForDocument replaces (does not append) and counts/references read back", () => {
    const { store } = setup()
    store.replaceForDocument("post", "p1", [{ assetId: "img1", field: "cover", label: "Launch" }])
    store.replaceForDocument("post", "p1", [{ assetId: "img2", field: "cover", label: "Launch v2" }])
    expect(store.counts()).toEqual({ img2: 1 })
    expect(store.references("img2")).toEqual([
      { collection: "post", documentId: "p1", field: "cover", label: "Launch v2" },
    ])
    expect(store.references("img1")).toEqual([])
  })

  test("counts distinct documents per asset", () => {
    const { store } = setup()
    store.replaceForDocument("post", "p1", [
      { assetId: "img1", field: "cover", label: "A" },
      { assetId: "img1", field: "body", label: "A" },
    ])
    store.replaceForDocument("post", "p2", [{ assetId: "img1", field: "cover", label: "B" }])
    expect(store.counts()).toEqual({ img1: 2 }) // two documents, not three references
    expect(store.references("img1").length).toBe(3)
  })

  test("removeDocument clears a document's rows", () => {
    const { store } = setup()
    store.replaceForDocument("post", "p1", [{ assetId: "img1", field: "cover", label: "A" }])
    store.removeDocument("post", "p1")
    expect(store.counts()).toEqual({})
  })

  test("replaceForDocument is atomic: a failed insert rolls back the delete", () => {
    const { store } = setup()
    store.replaceForDocument("post", "p1", [{ assetId: "img1", field: "cover", label: "A" }])
    // The second ref violates NOT NULL on label. The whole replace must abort,
    // leaving the prior index intact rather than a half-written (deleted) state.
    expect(() =>
      store.replaceForDocument("post", "p1", [
        { assetId: "img2", field: "cover", label: "B" },
        { assetId: "img3", field: "body", label: null as unknown as string },
      ]),
    ).toThrow()
    expect(store.counts()).toEqual({ img1: 1 })
    expect(store.references("img2")).toEqual([])
  })

  test("rebuild clears then repopulates from collections", async () => {
    const { store } = setup()
    store.replaceForDocument("post", "stale", [{ assetId: "old", field: "cover", label: "stale" }])
    const collections = new Map([
      ["post", { def: post, service: { findMany: async () => [{ id: "p1", title: "Launch", cover: "img1" }] } }],
    ])
    await store.rebuild(collections as any)
    expect(store.counts()).toEqual({ img1: 1 })
    expect(store.references("old")).toEqual([])
  })
})
