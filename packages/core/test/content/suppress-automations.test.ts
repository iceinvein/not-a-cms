import { afterEach, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import { sql } from "drizzle-orm"
import { createContentService } from "../../src/content/service"
import { createDatabase } from "../../src/db/connection"
import { generateTable } from "../../src/db/generate-table"
import { defineCollection } from "../../src/schema/collection"
import { field } from "../../src/schema/field"

const testDbPath = "test-content-suppress-automations.db"

const task = defineCollection({
  name: "task",
  fields: {
    title: field.text({ required: true }),
  },
})

describe("content automation dispatch suppression", () => {
  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("create can suppress automation dispatch without changing normal dispatch", async () => {
    const db = createDatabase({ url: testDbPath })
    db.run(sql`CREATE TABLE IF NOT EXISTS task (id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT, updated_at TEXT)`)
    const table = generateTable(task)
    const calls: Array<[string, string, Record<string, unknown>]> = []
    const service = createContentService(db, task, table, undefined, undefined, {
      dispatch: (event, collection, doc) => calls.push([event, collection, doc]),
    })

    await service.create({ title: "Quiet task" }, { suppressAutomations: true })

    expect(calls).toEqual([])

    await service.create({ title: "Loud task" })

    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toBe("content.created")
    expect(calls[0][1]).toBe("task")
    expect(calls[0][2].title).toBe("Loud task")
  })
})
