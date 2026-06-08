import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import { sql } from "drizzle-orm"
import { createFlowStore } from "../../src/automations/store"
import { bootstrapTables } from "../../src/db/bootstrap"
import { createDatabase } from "../../src/db/connection"

const testDbPath = "test-automations.db"
let db: ReturnType<typeof createDatabase>
let store: ReturnType<typeof createFlowStore>

const sampleTrigger = { type: "content.published" as const, collection: "posts" }
const sampleSteps = [
  { id: "s1", type: "action.log" as const, config: { message: "hello" }, next: null },
]

describe("flow store", () => {
  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
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

  test("createFlow() creates a flow with defaults", () => {
    const flow = store.createFlow({ name: "My Flow", trigger: sampleTrigger, steps: sampleSteps })
    expect(flow.id).toBeDefined()
    expect(flow.name).toBe("My Flow")
    expect(flow.active).toBe(true)
    expect(flow.trigger.type).toBe("content.published")
    expect(flow.steps).toHaveLength(1)
    expect(flow.created_at).toBeDefined()
    expect(flow.updated_at).toBeDefined()
  })

  test("createFlow() respects active=false", () => {
    const flow = store.createFlow({
      name: "Inactive",
      trigger: sampleTrigger,
      steps: [],
      active: false,
    })
    expect(flow.active).toBe(false)
  })

  test("listFlows() returns all flows ordered by created_at DESC", () => {
    store.createFlow({ name: "First", trigger: sampleTrigger, steps: [] })
    // Small delay to ensure distinct timestamps
    const start = Date.now()
    while (Date.now() - start < 2) {}
    store.createFlow({ name: "Second", trigger: sampleTrigger, steps: [] })
    const flows = store.listFlows()
    expect(flows).toHaveLength(2)
    // Most recently created should be first
    expect(flows[0].name).toBe("Second")
  })

  test("getFlowById() returns the flow when found", () => {
    const created = store.createFlow({
      name: "Find Me",
      trigger: sampleTrigger,
      steps: sampleSteps,
    })
    const found = store.getFlowById(created.id)
    expect(found).not.toBeNull()
    expect(found?.name).toBe("Find Me")
  })

  test("getFlowById() returns null when not found", () => {
    const result = store.getFlowById("nonexistent-id")
    expect(result).toBeNull()
  })

  test("updateFlow() merges changes", () => {
    const flow = store.createFlow({ name: "Original", trigger: sampleTrigger, steps: [] })
    const updated = store.updateFlow(flow.id, { name: "Updated", description: "A description" })
    expect(updated?.name).toBe("Updated")
    expect(updated?.description).toBe("A description")
    expect(updated?.trigger.type).toBe("content.published")
  })

  test("updateFlow() returns null for missing flow", () => {
    const result = store.updateFlow("nonexistent", { name: "x" })
    expect(result).toBeNull()
  })

  test("deleteFlow() removes the flow", () => {
    const flow = store.createFlow({ name: "To Delete", trigger: sampleTrigger, steps: [] })
    const result = store.deleteFlow(flow.id)
    expect(result).toBe(true)
    expect(store.listFlows()).toHaveLength(0)
  })

  test("deleteFlow() cascades to runs and run_steps", () => {
    const flow = store.createFlow({ name: "With Runs", trigger: sampleTrigger, steps: sampleSteps })
    const run = store.createRun(flow.id, "content.published")
    store.recordStep({ run_id: run.id, step_id: "s1", status: "completed" })
    store.deleteFlow(flow.id)
    // After delete, the flow should be gone
    expect(store.getFlowById(flow.id)).toBeNull()
    // Runs should also be gone (cascade)
    expect(store.getRun(run.id)).toBeNull()
  })

  test("toggleFlow() flips active state", () => {
    const flow = store.createFlow({ name: "Toggle Me", trigger: sampleTrigger, steps: [] })
    expect(flow.active).toBe(true)
    const toggled = store.toggleFlow(flow.id)
    expect(toggled?.active).toBe(false)
    const toggledBack = store.toggleFlow(flow.id)
    expect(toggledBack?.active).toBe(true)
  })

  test("toggleFlow() returns null for missing flow", () => {
    expect(store.toggleFlow("nonexistent")).toBeNull()
  })

  test("getActiveFlowsByTrigger() filters by trigger type and active status", () => {
    store.createFlow({
      name: "Active Published",
      trigger: { type: "content.published", collection: "posts" },
      steps: [],
      active: true,
    })
    store.createFlow({
      name: "Inactive Published",
      trigger: { type: "content.published" },
      steps: [],
      active: false,
    })
    store.createFlow({
      name: "Active Created",
      trigger: { type: "content.created" },
      steps: [],
      active: true,
    })
    const results = store.getActiveFlowsByTrigger("content.published")
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe("Active Published")
  })

  test("createRun() and getRun() work correctly", () => {
    const flow = store.createFlow({ name: "Run Flow", trigger: sampleTrigger, steps: [] })
    const run = store.createRun(flow.id, "content.published", JSON.stringify({ doc: "test" }))
    expect(run.id).toBeDefined()
    expect(run.flow_id).toBe(flow.id)
    expect(run.trigger_event).toBe("content.published")
    expect(run.status).toBe("running")
    expect(run.started_at).toBeDefined()

    const fetched = store.getRun(run.id)
    expect(fetched?.id).toBe(run.id)
    expect(fetched?.trigger_payload).toBe(JSON.stringify({ doc: "test" }))
  })

  test("getRun() returns null for missing run", () => {
    expect(store.getRun("nonexistent")).toBeNull()
  })

  test("completeRun() marks run as completed", () => {
    const flow = store.createFlow({ name: "Complete Flow", trigger: sampleTrigger, steps: [] })
    const run = store.createRun(flow.id, "content.published")
    store.completeRun(run.id, "completed")
    const fetched = store.getRun(run.id)
    expect(fetched?.status).toBe("completed")
    expect(fetched?.finished_at).toBeDefined()
    expect(fetched?.error).toBeUndefined()
  })

  test("completeRun() records error on failure", () => {
    const flow = store.createFlow({ name: "Fail Flow", trigger: sampleTrigger, steps: [] })
    const run = store.createRun(flow.id, "content.published")
    store.completeRun(run.id, "failed", "Something went wrong")
    const fetched = store.getRun(run.id)
    expect(fetched?.status).toBe("failed")
    expect(fetched?.error).toBe("Something went wrong")
  })

  test("recordStep() and getRunSteps() work correctly", () => {
    const flow = store.createFlow({ name: "Step Flow", trigger: sampleTrigger, steps: sampleSteps })
    const run = store.createRun(flow.id, "content.published")
    const step = store.recordStep({
      run_id: run.id,
      step_id: "s1",
      status: "completed",
      input: JSON.stringify({ doc: "test" }),
      output: JSON.stringify({ result: "ok" }),
    })
    expect(step.id).toBeDefined()
    expect(step.step_id).toBe("s1")
    expect(step.status).toBe("completed")
    expect(step.input).toBe(JSON.stringify({ doc: "test" }))
    expect(step.output).toBe(JSON.stringify({ result: "ok" }))

    const steps = store.getRunSteps(run.id)
    expect(steps).toHaveLength(1)
    expect(steps[0].id).toBe(step.id)
  })

  test("recordStep() records branch_taken for condition steps", () => {
    const flow = store.createFlow({ name: "Branch Flow", trigger: sampleTrigger, steps: [] })
    const run = store.createRun(flow.id, "content.published")
    const step = store.recordStep({
      run_id: run.id,
      step_id: "cond1",
      status: "completed",
      branch_taken: "true",
    })
    expect(step.branch_taken).toBe("true")
  })

  test("listRuns() returns runs with pagination", () => {
    const flow = store.createFlow({ name: "Paginated", trigger: sampleTrigger, steps: [] })
    for (let i = 0; i < 5; i++) {
      store.createRun(flow.id, "content.published")
    }
    const page1 = store.listRuns(flow.id, 3, 0)
    expect(page1).toHaveLength(3)
    const page2 = store.listRuns(flow.id, 3, 3)
    expect(page2).toHaveLength(2)
  })

  test("purgeOldRuns() deletes runs older than retention days", () => {
    const flow = store.createFlow({ name: "Purge Flow", trigger: sampleTrigger, steps: [] })

    // Create a current run
    const currentRun = store.createRun(flow.id, "content.published")

    // Create an old run and backdate it
    const oldRun = store.createRun(flow.id, "content.published")
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() // 10 days ago
    db.run(sql`UPDATE _flow_runs SET started_at = ${oldDate} WHERE id = ${oldRun.id}`)

    // Add a step to the old run so we can verify cascade delete
    store.recordStep({ run_id: oldRun.id, step_id: "s1", status: "completed" })

    // Purge runs older than 7 days
    const purged = store.purgeOldRuns(7)
    expect(purged).toBe(1)

    // Old run should be gone
    expect(store.getRun(oldRun.id)).toBeNull()

    // Current run should remain
    expect(store.getRun(currentRun.id)).not.toBeNull()

    // Old run's steps should be gone (cascade)
    expect(store.getRunSteps(oldRun.id)).toHaveLength(0)
  })
})
