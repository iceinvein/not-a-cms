import { test, expect, describe, afterEach } from "bun:test"
import { createDatabase } from "../../src/db/connection"
import { sql } from "drizzle-orm"
import { unlinkSync } from "node:fs"

const testDbPath = "test-connection.db"

describe("createDatabase", () => {
  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("creates a working database connection", () => {
    const db = createDatabase({ url: testDbPath })
    const result = db.get<{ one: number }>(sql`SELECT 1 as one`)
    expect(result?.one).toBe(1)
  })

  test("enables WAL mode", () => {
    const db = createDatabase({ url: testDbPath })
    const result = db.get<{ journal_mode: string }>(sql`PRAGMA journal_mode`)
    expect(result?.journal_mode).toBe("wal")
  })
})
