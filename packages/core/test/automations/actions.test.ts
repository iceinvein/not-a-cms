import { afterEach, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import { createFlowEngine } from "../../src/automations/engine"
import { createFlowStore } from "../../src/automations/store"
import { bootstrapTables } from "../../src/db/bootstrap"
import { createDatabase } from "../../src/db/connection"

const testDbPath = "test-automation-actions.db"

function engineWithSpies() {
  const db = createDatabase({ url: testDbPath })
  bootstrapTables(db, [])
  const store = createFlowStore(db)
  const calls: unknown[][] = []
  const engine = createFlowEngine(store, {
    content: {
      create: async (collection, data) => {
        calls.push(["create", collection, data])
        return { id: "new1", ...data }
      },
      update: async (collection, id, data) => {
        calls.push(["update", collection, id, data])
        return { id, ...data }
      },
      delete: async (collection, id) => {
        calls.push(["delete", collection, id])
        return true
      },
    },
    sendEmail: async (msg) => {
      calls.push(["email", msg])
    },
  })
  return { db, store, engine, calls }
}

describe("automation action adapters", () => {
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

  test("create_content calls the content adapter and returns the new id", async () => {
    const { store, engine, calls } = engineWithSpies()
    const flow = store.createFlow({
      name: "f",
      active: true,
      trigger: { type: "content.created", collection: "x" },
      steps: [
        {
          id: "a1",
          type: "action.create_content",
          config: { collection: "task", data: { title: "Hi" } },
          next: null,
        },
      ],
    })

    await engine.executeFlow(flow, {})

    expect(calls.find((call) => call[0] === "create")).toEqual(["create", "task", { title: "Hi" }])
  })

  test("email action sends via the mailer", async () => {
    const { store, engine, calls } = engineWithSpies()
    const flow = store.createFlow({
      name: "f",
      active: true,
      trigger: { type: "content.published" },
      steps: [
        {
          id: "a1",
          type: "action.email",
          config: { to: "x@y.z", subject: "Hi", body: "Body" },
          next: null,
        },
      ],
    })

    await engine.executeFlow(flow, {})

    expect(calls.find((call) => call[0] === "email")?.[1]).toMatchObject({
      to: "x@y.z",
      subject: "Hi",
    })
  })

  test("update_content reads documentId or legacy document_id", async () => {
    const { store, engine, calls } = engineWithSpies()
    const flow = store.createFlow({
      name: "f",
      active: true,
      trigger: { type: "content.updated" },
      steps: [
        {
          id: "a1",
          type: "action.update_content",
          config: { collection: "task", document_id: "d9", data: { done: "true" } },
          next: null,
        },
      ],
    })

    await engine.executeFlow(flow, {})

    expect(calls.find((call) => call[0] === "update")).toEqual([
      "update",
      "task",
      "d9",
      { done: "true" },
    ])
  })

  test("a content action with no adapter configured fails the run cleanly", async () => {
    const db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [])
    const store = createFlowStore(db)
    const engine = createFlowEngine(store)
    const flow = store.createFlow({
      name: "f",
      active: true,
      trigger: { type: "content.created" },
      steps: [
        {
          id: "a1",
          type: "action.create_content",
          config: { collection: "task", data: {} },
          next: null,
        },
      ],
    })

    const runId = await engine.executeFlow(flow, {})

    expect(store.getRun(runId)!.status).toBe("failed")
  })
})
