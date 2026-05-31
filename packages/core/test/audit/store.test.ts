import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import { createAuditLogStore } from "../../src/audit/store"
import { bootstrapTables } from "../../src/db/bootstrap"
import { createDatabase } from "../../src/db/connection"

const testDbPath = "test-audit.db"

describe("createAuditLogStore", () => {
  let db: ReturnType<typeof createDatabase>
  let store: ReturnType<typeof createAuditLogStore>

  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [])
    store = createAuditLogStore(db)
  })

  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("record() stores an audit event with actor and document context", () => {
    const event = store.record({
      action: "content.created",
      actorId: "user-1",
      actorRole: "admin",
      collection: "page",
      documentId: "doc-1",
      summary: "Created page",
      after: { title: "Hello" },
    })

    expect(event.id).toBeDefined()
    expect(event.action).toBe("content.created")
    expect(event.after).toEqual({ title: "Hello" })
    expect(event.createdAt).toBeDefined()
  })

  test("list() returns newest events first and filters by collection", () => {
    store.record({ action: "content.created", collection: "page", documentId: "page-1" })
    store.record({ action: "content.updated", collection: "post", documentId: "post-1" })
    store.record({ action: "content.deleted", collection: "page", documentId: "page-2" })

    const pageEvents = store.list({ collection: "page" })

    expect(pageEvents.map((event) => event.documentId)).toEqual(["page-2", "page-1"])
  })
})
