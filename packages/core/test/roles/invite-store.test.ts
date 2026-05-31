import { afterEach, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import { sql } from "drizzle-orm"
import { createDatabase } from "../../src/db/connection"
import { createInviteStore } from "../../src/roles/invite-store"

const testDbPath = "test-invite-store.db"

function setupDb() {
  const db = createDatabase({ url: testDbPath })
  db.run(sql`CREATE TABLE IF NOT EXISTS _invites (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    accepted_at TEXT,
    accepted_user_id TEXT,
    revoked_at TEXT,
    created_at TEXT NOT NULL
  )`)
  return db
}

describe("createInviteStore", () => {
  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("create() stores a token hash and returns the raw token once", () => {
    const db = setupDb()
    const store = createInviteStore(db)

    const created = store.create({ email: "Editor@Example.test", role: "editor" })
    const rows = db.all(sql`SELECT token_hash FROM _invites WHERE id = ${created.invite.id}`) as Array<{ token_hash: string }>

    expect(created.token).toBeTruthy()
    expect(created.invite.email).toBe("editor@example.test")
    expect(rows[0].token_hash).not.toBe(created.token)
    expect(rows[0].token_hash).toHaveLength(64)
  })

  test("acceptByEmail() accepts the newest active invite for an email", () => {
    const db = setupDb()
    const store = createInviteStore(db)
    store.create({ email: "editor@example.test", role: "editor" })

    const accepted = store.acceptByEmail("EDITOR@example.test", "user-1")

    expect(accepted?.role).toBe("editor")
    expect(accepted?.acceptedAt).toBeTruthy()
    expect(accepted?.acceptedUserId).toBe("user-1")
    expect(store.listPending()).toHaveLength(0)
  })

  test("revoke() removes an invite from the pending list", () => {
    const db = setupDb()
    const store = createInviteStore(db)
    const created = store.create({ email: "viewer@example.test", role: "viewer" })

    expect(store.revoke(created.invite.id)).toBe(true)
    expect(store.listPending()).toHaveLength(0)
  })
})
