import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import { createFlowStore } from "../../src/automations/store"
import { bootstrapTables } from "../../src/db/bootstrap"
import { createDatabase } from "../../src/db/connection"

const testDbPath = "test-recent-runs.db"
let store: ReturnType<typeof createFlowStore>

describe("listRecentRuns", () => {
  beforeEach(() => {
    const db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [])
    store = createFlowStore(db)
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
  })

  test("returns runs across all flows, newest first, optional status filter", () => {
    const f1 = store.createFlow({
      name: "a",
      trigger: { type: "content.created" },
      steps: [],
      active: true,
    })
    const f2 = store.createFlow({
      name: "b",
      trigger: { type: "content.created" },
      steps: [],
      active: true,
    })
    const r1 = store.createRun(f1.id, "content.created", "{}")
    store.completeRun(r1.id, "completed")
    const r2 = store.createRun(f2.id, "content.created", "{}")
    store.completeRun(r2.id, "failed", "boom")

    const all = store.listRecentRuns({ limit: 10 })
    expect(all.length).toBe(2)
    expect(all[0].id).toBe(r2.id)

    const failed = store.listRecentRuns({ status: "failed", limit: 10 })
    expect(failed.map((r) => r.id)).toEqual([r2.id])
  })
})
