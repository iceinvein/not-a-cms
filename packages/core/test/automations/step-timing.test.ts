import { afterEach, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import { createFlowStore } from "../../src/automations/store"
import { bootstrapTables } from "../../src/db/bootstrap"
import { createDatabase } from "../../src/db/connection"

const testDbPath = "test-automations-step-timing.db"

describe("recordStep timing", () => {
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

  test("persists distinct started_at and finished_at when provided", () => {
    const db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [])
    const store = createFlowStore(db)
    const flow = store.createFlow({
      name: "t",
      trigger: { type: "content.created" },
      steps: [],
      active: true,
    })
    const run = store.createRun(flow.id, "content.created", "{}")

    store.recordStep({
      run_id: run.id,
      step_id: "s1",
      status: "completed",
      input: "{}",
      output: "{}",
      started_at: "2026-06-01T10:00:00.000Z",
      finished_at: "2026-06-01T10:00:01.250Z",
    })

    const step = store.getRunSteps(run.id).find((s) => s.step_id === "s1")!
    expect(step.started_at).toBe("2026-06-01T10:00:00.000Z")
    expect(step.finished_at).toBe("2026-06-01T10:00:01.250Z")
  })
})
