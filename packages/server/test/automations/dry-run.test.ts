import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { createDatabase, bootstrapTables, createFlowStore, createFlowEngine } from "@not-a-cms/core"
import { createAutomationHandler } from "../../src/automations/handler"
import { unlinkSync } from "node:fs"

const testDbPath = "test-server-dry-run.db"
let handler: ReturnType<typeof createAutomationHandler>
let store: ReturnType<typeof createFlowStore>

beforeEach(() => {
  const db = createDatabase({ url: testDbPath })
  bootstrapTables(db, [])
  store = createFlowStore(db)
  const engine = createFlowEngine(store, {})
  handler = createAutomationHandler(store, engine)
})

afterEach(() => {
  try { unlinkSync(testDbPath) } catch {}
  try { unlinkSync(testDbPath + "-wal") } catch {}
  try { unlinkSync(testDbPath + "-shm") } catch {}
})

describe("POST /api/_flows/dry-run", () => {
  test("returns a simulated run result for the posted flow", async () => {
    const flow = {
      id: "x", name: "Test", active: false, created_at: "", updated_at: "",
      trigger: { type: "content.created", collection: "posts" },
      steps: [{ id: "a1", type: "action.email", config: { to: "a@b.test", subject: "Hi {{document.title}}" }, next: null }],
    }
    const res = await handler(new Request("http://localhost/api/_flows/dry-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flow, payload: { document: { title: "Z" } } }),
    }))
    expect(res?.status).toBe(200)
    const body = await res!.json()
    expect(body.status).toBe("completed")
    expect(body.steps).toHaveLength(1)
    expect(body.steps[0].simulated).toBe(true)
    expect(body.steps[0].summary).toBe("would email a@b.test: Hi Z")
  })

  test("does not persist anything", async () => {
    const flow = {
      id: "x", name: "Test", active: false, created_at: "", updated_at: "",
      trigger: { type: "content.created" },
      steps: [{ id: "a1", type: "action.log", config: { message: "hi" }, next: null }],
    }
    await handler(new Request("http://localhost/api/_flows/dry-run", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flow }),
    }))
    expect(store.listRecentRuns({})).toHaveLength(0)
  })

  test("returns 400 when flow is missing", async () => {
    const res = await handler(new Request("http://localhost/api/_flows/dry-run", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: {} }),
    }))
    expect(res?.status).toBe(400)
  })
})
