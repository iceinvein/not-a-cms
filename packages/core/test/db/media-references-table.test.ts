import { afterEach, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import { sql } from "drizzle-orm"
import { createDatabase } from "../../src/db/connection"
import { bootstrapTables } from "../../src/db/bootstrap"

const testDbPath = "test-media-refs-table.db"

afterEach(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try { unlinkSync(testDbPath + suffix) } catch {}
  }
})

test("bootstrap creates a queryable media_references table", () => {
  const db = createDatabase({ url: testDbPath })
  bootstrapTables(db, [])
  db.run(sql`INSERT INTO media_references (asset_id, collection, document_id, field, label) VALUES ('a', 'post', 'p1', 'cover', 'Launch')`)
  const rows = db.all(sql`SELECT asset_id AS assetId FROM media_references WHERE asset_id = 'a'`) as { assetId: string }[]
  expect(rows[0]?.assetId).toBe("a")
})
