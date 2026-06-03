import { afterEach, describe, expect, test, spyOn } from "bun:test"
import { unlinkSync } from "node:fs"
import { createFlowEngine } from "../../src/automations/engine"
import { createFlowStore } from "../../src/automations/store"
import { bootstrapTables } from "../../src/db/bootstrap"
import { createDatabase } from "../../src/db/connection"

const testDbPath = "test-automation-dry-run.db"

function engineWithSpies() {
  const db = createDatabase({ url: testDbPath })
  bootstrapTables(db, [])
  const store = createFlowStore(db)
  const calls: unknown[][] = []
  const engine = createFlowEngine(store, {
    content: {
      create: async (collection, data) => { calls.push(["create", collection, data]); return { id: "real-id", ...data } },
      update: async (collection, id, data) => { calls.push(["update", collection, id, data]); return { id, ...data } },
      delete: async (collection, id) => { calls.push(["delete", collection, id]); return true },
    },
    sendEmail: async (msg) => { calls.push(["email", msg]) },
  })
  return { db, store, engine, calls }
}

describe("flow engine dry-run", () => {
  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("simulates create_content without calling the content adapter", async () => {
    const { engine, calls } = engineWithSpies()
    const flow = {
      id: "f1", name: "f", active: false, created_at: "", updated_at: "",
      trigger: { type: "content.created" as const, collection: "posts" },
      steps: [{ id: "a1", type: "action.create_content" as const, config: { collection: "posts", data: { title: "{{document.title}}" } }, next: null }],
    }
    const result = await engine.dryRun(flow, { document: { title: "Hello" } })

    expect(result.status).toBe("completed")
    expect(result.steps).toHaveLength(1)
    const step = result.steps[0]
    expect(step.simulated).toBe(true)
    expect(step.summary).toContain("would create")
    const output = JSON.parse(step.output!)
    expect(output).toMatchObject({ action: "create_content", collection: "posts", documentId: "(simulated)", data: { title: "Hello" } })
    expect(calls).toHaveLength(0)
  })

  test("simulates webhook without calling fetch", async () => {
    const fetchSpy = spyOn(globalThis, "fetch")
    const { engine, calls } = engineWithSpies()
    const flow = {
      id: "f2", name: "f", active: false, created_at: "", updated_at: "",
      trigger: { type: "webhook.received" as const },
      steps: [{ id: "a1", type: "action.webhook" as const, config: { url: "https://example.test/{{id}}", method: "POST" }, next: null }],
    }
    const result = await engine.dryRun(flow, { id: "42" })

    const step = result.steps[0]
    expect(step.simulated).toBe(true)
    expect(step.summary).toBe("would POST https://example.test/42")
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(calls).toHaveLength(0)
    fetchSpy.mockRestore()
  })

  test("simulates email without sending", async () => {
    const { engine, calls } = engineWithSpies()
    const flow = {
      id: "f3", name: "f", active: false, created_at: "", updated_at: "",
      trigger: { type: "content.created" as const },
      steps: [{ id: "a1", type: "action.email" as const, config: { to: "a@b.test", subject: "Hi {{document.title}}" }, next: null }],
    }
    const result = await engine.dryRun(flow, { document: { title: "X" } })
    const step = result.steps[0]
    expect(step.simulated).toBe(true)
    expect(step.summary).toBe("would email a@b.test: Hi X")
    expect(calls).toHaveLength(0)
  })

  test("runs condition + transform for real and follows branches", async () => {
    const { engine } = engineWithSpies()
    const flow = {
      id: "f4", name: "f", active: false, created_at: "", updated_at: "",
      trigger: { type: "content.created" as const },
      steps: [
        { id: "c1", type: "condition" as const, match: "all" as const, rules: [{ field: "document.category", operator: "eq" as const, value: "news" }], branches: { true: "t1", false: null } },
        { id: "t1", type: "action.transform" as const, config: { mappings: { slug: "{{document.category}}" } }, next: null },
      ],
    }
    const result = await engine.dryRun(flow, { document: { category: "news" } })

    expect(result.status).toBe("completed")
    expect(result.steps).toHaveLength(2)
    expect(result.steps[0].branch_taken).toBe("true")
    expect(result.steps[0].simulated).toBeFalsy()
    expect(JSON.parse(result.steps[1].output!)).toEqual({ slug: "news" })
  })

  test("empty-steps flow completes with no steps", async () => {
    const { engine } = engineWithSpies()
    const flow = {
      id: "f5", name: "f", active: false, created_at: "", updated_at: "",
      trigger: { type: "content.created" as const }, steps: [],
    }
    const result = await engine.dryRun(flow, {})
    expect(result.status).toBe("completed")
    expect(result.steps).toHaveLength(0)
  })

  test("simulates update_content (document_id alias) without calling the adapter", async () => {
    const { engine, calls } = engineWithSpies()
    const flow = {
      id: "f7", name: "f", active: false, created_at: "", updated_at: "",
      trigger: { type: "content.updated" as const, collection: "posts" },
      steps: [{ id: "a1", type: "action.update_content" as const, config: { collection: "posts", document_id: "{{document.id}}", data: { title: "{{document.title}}" } }, next: null }],
    }
    const result = await engine.dryRun(flow, { document: { id: "p1", title: "New" } })
    const step = result.steps[0]
    expect(step.simulated).toBe(true)
    expect(step.summary).toContain("would update")
    const output = JSON.parse(step.output!)
    expect(output).toMatchObject({ action: "update_content", collection: "posts", documentId: "p1", data: { title: "New" } })
    expect(calls).toHaveLength(0)
  })

  test("simulates delete_content without calling the adapter", async () => {
    const { engine, calls } = engineWithSpies()
    const flow = {
      id: "f8", name: "f", active: false, created_at: "", updated_at: "",
      trigger: { type: "content.deleted" as const, collection: "posts" },
      steps: [{ id: "a1", type: "action.delete_content" as const, config: { collection: "posts", documentId: "{{document.id}}" }, next: null }],
    }
    const result = await engine.dryRun(flow, { document: { id: "p9" } })
    const step = result.steps[0]
    expect(step.simulated).toBe(true)
    expect(step.summary).toContain("would delete")
    const output = JSON.parse(step.output!)
    expect(output).toMatchObject({ action: "delete_content", collection: "posts", documentId: "p9", deleted: true })
    expect(calls).toHaveLength(0)
  })

  test("dry-run does not persist a run", async () => {
    const { engine, store } = engineWithSpies()
    const flow = {
      id: "f6", name: "f", active: false, created_at: "", updated_at: "",
      trigger: { type: "content.created" as const },
      steps: [{ id: "a1", type: "action.log" as const, config: { message: "hi" }, next: null }],
    }
    await engine.dryRun(flow, {})
    expect(store.listRecentRuns({})).toHaveLength(0)
  })
})
