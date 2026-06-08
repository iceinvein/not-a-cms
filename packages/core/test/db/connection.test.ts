import { afterEach, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import { sql } from "drizzle-orm"
import { createDatabase } from "../../src/db/connection"

const testDbPath = "test-connection.db"

describe("createDatabase", () => {
  afterEach(() => {
    try {
      unlinkSync(testDbPath)
    } catch {}
    try {
      unlinkSync(testDbPath + "-wal")
    } catch {}
    try {
      unlinkSync(testDbPath + "-shm")
    } catch {}
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
