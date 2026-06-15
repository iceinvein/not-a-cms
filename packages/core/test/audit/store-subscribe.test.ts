import { afterEach, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import { bootstrapTables, createAuditLogStore, createDatabase } from "../../src/index"

const dbPath = "test-core-audit-subscribe.db"

function freshStore() {
  const db = createDatabase({ url: dbPath })
  bootstrapTables(db, [])
  return createAuditLogStore(db)
}

afterEach(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      unlinkSync(dbPath + suffix)
    } catch {}
  }
})

describe("audit log store subscription", () => {
  test("subscribers receive the recorded event", () => {
    const store = freshStore()
    const seen: string[] = []
    store.subscribe((e) => seen.push(e.action))
    store.record({ action: "content.created", collection: "page", documentId: "home" })
    expect(seen).toEqual(["content.created"])
  })

  test("unsubscribe stops delivery", () => {
    const store = freshStore()
    const seen: string[] = []
    const off = store.subscribe((e) => seen.push(e.action))
    off()
    store.record({ action: "content.updated", collection: "page", documentId: "home" })
    expect(seen).toEqual([])
  })

  test("a throwing subscriber does not break record() or siblings", () => {
    const store = freshStore()
    const seen: string[] = []
    store.subscribe(() => {
      throw new Error("boom")
    })
    store.subscribe((e) => seen.push(e.action))
    const event = store.record({ action: "content.deleted", collection: "page", documentId: "x" })
    expect(event.action).toBe("content.deleted")
    expect(seen).toEqual(["content.deleted"])
  })
})
