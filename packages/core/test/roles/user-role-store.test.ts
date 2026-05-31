import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import { bootstrapTables, createDatabase, createUserRoleStore } from "../../src"

const testDbPath = "test-user-roles.db"

describe("createUserRoleStore", () => {
  let db: ReturnType<typeof createDatabase>
  let store: ReturnType<typeof createUserRoleStore>

  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [])
    store = createUserRoleStore(db)
  })

  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(`${testDbPath}-wal`) } catch {}
    try { unlinkSync(`${testDbPath}-shm`) } catch {}
  })

  test("upsert() creates and updates a user role assignment", () => {
    store.upsert({ userId: "user-1", email: "editor@example.test", role: "editor" })
    store.upsert({ userId: "user-1", email: "editor@example.test", role: "admin" })

    const record = store.get("user-1")
    expect(record?.email).toBe("editor@example.test")
    expect(record?.role).toBe("admin")
    expect(record?.active).toBe(true)
  })

  test("list() returns newest assignments first", () => {
    store.upsert({ userId: "user-1", role: "editor" })
    store.upsert({ userId: "user-2", role: "author" })

    expect(store.list().map((record) => record.userId)).toEqual(["user-2", "user-1"])
  })

  test("hasActiveAdmin() tracks active admin assignments", () => {
    expect(store.hasActiveAdmin()).toBe(false)

    store.upsert({ userId: "user-1", role: "admin", active: false })
    expect(store.hasActiveAdmin()).toBe(false)

    store.upsert({ userId: "user-1", role: "admin", active: true })
    expect(store.hasActiveAdmin()).toBe(true)
  })
})
