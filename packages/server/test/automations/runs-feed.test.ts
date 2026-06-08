import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import { bootstrapTables, createDatabase, createFlowStore, type FlowEngine } from "@not-a-cms/core"
import { createAutomationHandler } from "../../src/automations/handler"

const testDbPath = "test-automation-runs-feed.db"
let handler: ReturnType<typeof createAutomationHandler>
let store: ReturnType<typeof createFlowStore>

const engine = {
  executeFlow: async () => "run-id",
  retryRun: async () => "retry-id",
} as unknown as FlowEngine

describe("automation runs feed", () => {
  beforeEach(() => {
    const db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [])
    store = createFlowStore(db)
    handler = createAutomationHandler(store, engine)
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

  test("GET /api/_flows/runs returns failed runs across flows", async () => {
    const flow = store.createFlow({
      name: "Failed Feed",
      trigger: { type: "content.created" },
      steps: [],
    })
    const run = store.createRun(flow.id, "content.created")
    store.completeRun(run.id, "failed", "boom")

    const res = await handler(new Request("http://localhost/api/_flows/runs?status=failed"))
    expect(res?.status).toBe(200)
    const body = await res!.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].status).toBe("failed")
  })
})
