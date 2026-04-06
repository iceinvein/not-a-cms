import { test, expect, describe, afterEach } from "bun:test"
import { createDatabase } from "../../src/db/connection"
import { bootstrapTables } from "../../src/db/bootstrap"
import { defineCollection } from "../../src/schema/collection"
import { field } from "../../src/schema/field"
import { sql } from "drizzle-orm"
import { unlinkSync } from "node:fs"

const testDbPath = "test-bootstrap.db"

describe("bootstrapTables", () => {
  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("creates tables for collections", () => {
    const db = createDatabase({ url: testDbPath })
    const col = defineCollection({
      name: "test_create",
      fields: { title: field.text() },
    })
    bootstrapTables(db, [col])

    const rows = db.all(sql`${sql.raw("PRAGMA table_info(test_create)")}`) as Array<{ name: string }>
    const colNames = rows.map(r => r.name)
    expect(colNames).toContain("id")
    expect(colNames).toContain("title")
    expect(colNames).toContain("created_at")
    expect(colNames).toContain("updated_at")
  })

  test("adds missing columns to existing tables", () => {
    const db = createDatabase({ url: testDbPath })

    // Create table with fewer fields (simulates older schema)
    const v1 = defineCollection({
      name: "test_migrate",
      fields: { title: field.text() },
    })
    bootstrapTables(db, [v1])

    // Now bootstrap with an additional field
    const v2 = defineCollection({
      name: "test_migrate",
      fields: {
        title: field.text(),
        layout: field.pageLayout(),
      },
    })
    bootstrapTables(db, [v2])

    // Verify the new column exists by inserting data
    db.run(sql`${sql.raw("INSERT INTO test_migrate (id, title, layout) VALUES ('1', 'Test', '{}')")}`)
    const rows = db.all(sql`${sql.raw("SELECT * FROM test_migrate WHERE id = '1'")}`) as any[]
    expect(rows[0].layout).toBe("{}")
  })

  test("adds missing relation columns with _id suffix", () => {
    const db = createDatabase({ url: testDbPath })

    const v1 = defineCollection({
      name: "test_relation",
      fields: { title: field.text() },
    })
    bootstrapTables(db, [v1])

    const v2 = defineCollection({
      name: "test_relation",
      fields: {
        title: field.text(),
        author: field.relation("user"),
      },
    })
    bootstrapTables(db, [v2])

    const rows = db.all(sql`${sql.raw("PRAGMA table_info(test_relation)")}`) as Array<{ name: string }>
    const colNames = rows.map(r => r.name)
    expect(colNames).toContain("author_id")
  })

  test("does not fail when columns already exist", () => {
    const db = createDatabase({ url: testDbPath })

    const col = defineCollection({
      name: "test_idempotent",
      fields: {
        title: field.text(),
        slug: field.slug({ from: "title" }),
      },
    })

    // Run bootstrap twice — second run should not fail
    bootstrapTables(db, [col])
    bootstrapTables(db, [col])

    const rows = db.all(sql`${sql.raw("PRAGMA table_info(test_idempotent)")}`) as Array<{ name: string }>
    const colNames = rows.map(r => r.name)
    expect(colNames).toContain("title")
    expect(colNames).toContain("slug")
  })
})
