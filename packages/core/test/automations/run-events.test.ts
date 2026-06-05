import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { unlinkSync } from "node:fs"
import { createDatabase } from "../../src/db/connection"
import { bootstrapTables } from "../../src/db/bootstrap"
import { createFlowStore } from "../../src/automations/store"
import { createFlowEngine } from "../../src/automations/engine"
import type { RunEvent } from "../../src/automations/events"

const testDbPath = "test-automations-run-events.db"
let db: ReturnType<typeof createDatabase>
let store: ReturnType<typeof createFlowStore>

describe("engine run events", () => {
  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [])
    store = createFlowStore(db)
  })
  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("executeFlow emits started, a step per executed node, then completed", async () => {
    const events: RunEvent[] = []
    const flow = store.createFlow({
      name: "Events", trigger: { type: "content.created" },
      steps: [
        { id: "c1", type: "condition", rules: [{ field: "document.ok", operator: "eq", value: true }], match: "all", branches: { true: "a1", false: null } },
        { id: "a1", type: "action.log", config: { message: "hi" }, next: null },
      ],
    })
    const engine = createFlowEngine(store, { onRunEvent: (e) => events.push(e) })
    const runId = await engine.executeFlow(flow, { event: "content.created", document: { ok: true } })

    expect(events[0].type).toBe("run.started")
    expect((events[0] as Extract<RunEvent, { type: "run.started" }>).run.id).toBe(runId)

    const stepEvents = events.filter((e): e is Extract<RunEvent, { type: "run.step" }> => e.type === "run.step")
    expect(stepEvents).toHaveLength(2)
    expect(stepEvents[0].flowId).toBe(flow.id)
    expect(stepEvents[0].runId).toBe(runId)

    const last = events[events.length - 1]
    expect(last.type).toBe("run.completed")
    expect((last as Extract<RunEvent, { type: "run.completed" }>).run.status).toBe("completed")
    expect((last as Extract<RunEvent, { type: "run.completed" }>).run.finished_at).toBeTruthy()
  })

  test("dryRun emits nothing", async () => {
    const events: RunEvent[] = []
    const flow = store.createFlow({
      name: "Dry", trigger: { type: "content.created" },
      steps: [{ id: "a1", type: "action.email", config: { to: "x@y.z", subject: "Hi" }, next: null }],
    })
    const engine = createFlowEngine(store, { onRunEvent: (e) => events.push(e) })
    await engine.dryRun(flow, { event: "content.created", document: {} })
    expect(events).toHaveLength(0)
  })
})
