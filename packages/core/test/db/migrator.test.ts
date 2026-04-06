import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { unlinkSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { createDatabase } from "../../src/db/connection"
import { createMigrator } from "../../src/db/migrator"
import { sql } from "drizzle-orm"

const testDbPath = "test-migrator.db"
const testMigrationsDir = "test-migrations"

let db: ReturnType<typeof createDatabase>

describe("createMigrator", () => {
  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    mkdirSync(testMigrationsDir, { recursive: true })
  })

  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
    try { rmSync(testMigrationsDir, { recursive: true }) } catch {}
  })

  test("creates _migrations table on init", () => {
    const migrator = createMigrator(db, testMigrationsDir)
    migrator.init()
    const rows = db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'`)
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
    writeFileSync(join(testMigrationsDir, "001_init.sql"), "CREATE TABLE test_table (id TEXT PRIMARY KEY, name TEXT);")
    const migrator = createMigrator(db, testMigrationsDir)
    migrator.init()

    const result = migrator.run()
    expect(result.applied).toHaveLength(1)
    expect(result.applied[0]).toBe("001_init.sql")

    const rows = db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'`)
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
    writeFileSync(join(testMigrationsDir, "002_add_col.sql"), "ALTER TABLE t1 ADD COLUMN name TEXT;")
    const migrator = createMigrator(db, testMigrationsDir)
    migrator.init()

    migrator.run()
    writeFileSync(join(testMigrationsDir, "003_new.sql"), "CREATE TABLE t2 (id TEXT);")

    const status = migrator.status()
    expect(status.applied).toHaveLength(2)
    expect(status.pending).toHaveLength(1)
    expect(status.pending[0]).toBe("003_new.sql")
  })
})
