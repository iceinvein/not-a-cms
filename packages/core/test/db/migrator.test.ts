import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { sql } from "drizzle-orm"
import { bootstrapTables } from "../../src/db/bootstrap"
import { createDatabase } from "../../src/db/connection"
import { createMigrator } from "../../src/db/migrator"
import { generateMigrationSQL } from "../../src/db/schema-generator"
import { defineCollection } from "../../src/schema/collection"
import { field } from "../../src/schema/field"

const testDbPath = "test-migrator.db"
const testMigrationsDir = "test-migrations"

let db: ReturnType<typeof createDatabase>

describe("createMigrator", () => {
  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    mkdirSync(testMigrationsDir, { recursive: true })
  })

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
    try {
      rmSync(testMigrationsDir, { recursive: true })
    } catch {}
  })

  test("creates _migrations table on init", () => {
    const migrator = createMigrator(db, testMigrationsDir)
    migrator.init()
    const rows = db.all(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'`,
    )
    expect((rows as any[]).length).toBe(1)
  })

  test("status() returns empty for no migrations", () => {
    const migrator = createMigrator(db, testMigrationsDir)
    migrator.init()
    const status = migrator.status()
    expect(status.applied).toHaveLength(0)
    expect(status.pending).toHaveLength(0)
  })

  test("status() shows pending migrations", () => {
    writeFileSync(join(testMigrationsDir, "001_init.sql"), "CREATE TABLE test1 (id TEXT);")
    const migrator = createMigrator(db, testMigrationsDir)
    migrator.init()
    const status = migrator.status()
    expect(status.pending).toHaveLength(1)
    expect(status.pending[0]).toBe("001_init.sql")
  })

  test("run() applies pending migrations", () => {
    writeFileSync(
      join(testMigrationsDir, "001_init.sql"),
      "CREATE TABLE test_table (id TEXT PRIMARY KEY, name TEXT);",
    )
    const migrator = createMigrator(db, testMigrationsDir)
    migrator.init()

    const result = migrator.run()
    expect(result.applied).toHaveLength(1)
    expect(result.applied[0]).toBe("001_init.sql")

    const rows = db.all(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'`,
    )
    expect((rows as any[]).length).toBe(1)
  })

  test("run() skips already-applied migrations", () => {
    writeFileSync(join(testMigrationsDir, "001_init.sql"), "CREATE TABLE test_table (id TEXT);")
    const migrator = createMigrator(db, testMigrationsDir)
    migrator.init()

    migrator.run()
    const result2 = migrator.run()
    expect(result2.applied).toHaveLength(0)
  })

  test("run() applies migrations in filename order", () => {
    writeFileSync(join(testMigrationsDir, "002_second.sql"), "CREATE TABLE t2 (id TEXT);")
    writeFileSync(join(testMigrationsDir, "001_first.sql"), "CREATE TABLE t1 (id TEXT);")
    const migrator = createMigrator(db, testMigrationsDir)
    migrator.init()

    const result = migrator.run()
    expect(result.applied).toEqual(["001_first.sql", "002_second.sql"])
  })

  test("status() shows applied and pending correctly", () => {
    writeFileSync(join(testMigrationsDir, "001_init.sql"), "CREATE TABLE t1 (id TEXT);")
    writeFileSync(
      join(testMigrationsDir, "002_add_col.sql"),
      "ALTER TABLE t1 ADD COLUMN name TEXT;",
    )
    const migrator = createMigrator(db, testMigrationsDir)
    migrator.init()

    migrator.run()
    writeFileSync(join(testMigrationsDir, "003_new.sql"), "CREATE TABLE t2 (id TEXT);")

    const status = migrator.status()
    expect(status.applied).toHaveLength(2)
    expect(status.pending).toHaveLength(1)
    expect(status.pending[0]).toBe("003_new.sql")
  })

  test("generateMigrationSQL creates tables only for new collections when a DB is provided", () => {
    db.run(
      sql`${sql.raw("CREATE TABLE existing (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, title TEXT);")}`,
    )
    const existing = defineCollection({
      name: "existing",
      fields: { title: field.text() },
    })
    const next = defineCollection({
      name: "next",
      fields: { title: field.text({ required: true }) },
    })

    const migration = generateMigrationSQL([existing, next], { db })

    expect(migration).not.toContain("CREATE TABLE IF NOT EXISTS existing")
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS next")
  })

  test("generateMigrationSQL adds missing columns for existing collections", () => {
    db.run(
      sql`${sql.raw("CREATE TABLE post (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, title TEXT);")}`,
    )
    const post = defineCollection({
      name: "post",
      fields: {
        title: field.text(),
        publishedAt: field.datetime(),
        author: field.relation("author"),
      },
    })

    const migration = generateMigrationSQL([post], { db })

    expect(migration).toContain("ALTER TABLE post ADD COLUMN published_at TEXT;")
    expect(migration).toContain("ALTER TABLE post ADD COLUMN author_id TEXT;")
    expect(migration).not.toContain("ADD COLUMN title")
  })

  test("generateMigrationSQL refuses destructive schema changes by default", () => {
    db.run(
      sql`${sql.raw("CREATE TABLE post (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, title TEXT, old_field TEXT);")}`,
    )
    const post = defineCollection({
      name: "post",
      fields: { title: field.text() },
    })

    expect(() => generateMigrationSQL([post], { db })).toThrow("Destructive change detected")
  })

  test("generateMigrationSQL can acknowledge destructive changes with an explicit flag", () => {
    db.run(
      sql`${sql.raw("CREATE TABLE post (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, title TEXT, old_field TEXT);")}`,
    )
    const post = defineCollection({
      name: "post",
      fields: { title: field.text() },
    })

    const migration = generateMigrationSQL([post], { db, allowDestructive: true })

    expect(migration).toContain("-- Destructive change detected for post.old_field")
  })

  test("generateMigrationSQL guards system index DDL on already-present indexes", () => {
    // Fresh DB: nothing exists yet, so the system index DDL is emitted.
    const fresh = generateMigrationSQL([], { db })
    expect(fresh).toContain("media_references_asset")

    // After bootstrap creates the tables and their indexes, the DDL is omitted,
    // matching how table CREATEs are already guarded by tableExists().
    bootstrapTables(db, [])
    const afterBootstrap = generateMigrationSQL([], { db })
    expect(afterBootstrap).not.toContain("media_references_asset")
    expect(afterBootstrap).not.toContain("idx_versions_lookup")
  })
})
