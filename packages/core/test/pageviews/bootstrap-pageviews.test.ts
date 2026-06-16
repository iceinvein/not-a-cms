import { afterEach, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import { sql } from "drizzle-orm"
import { bootstrapTables, createDatabase } from "../../src/index"

const dbPath = "test-core-pageviews-bootstrap.db"

afterEach(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      unlinkSync(dbPath + suffix)
    } catch {}
  }
})

describe("bootstrap _pageviews", () => {
  test("creates the _pageviews table", () => {
    const db = createDatabase({ url: dbPath })
    bootstrapTables(db, [])
    const rows = db.all(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name='_pageviews'`,
    ) as Array<{ name: string }>
    expect(rows.length).toBe(1)
  })
})
