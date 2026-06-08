import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import {
  createFlowEngine,
  evaluateCondition,
  interpolate,
  resolvePayloadPath,
} from "../../src/automations/engine"
import { createFlowStore } from "../../src/automations/store"
import type { ConditionRule, FlowStep } from "../../src/automations/types"
import { bootstrapTables } from "../../src/db/bootstrap"
import { createDatabase } from "../../src/db/connection"

const testDbPath = "test-automations-engine.db"
let db: ReturnType<typeof createDatabase>
let store: ReturnType<typeof createFlowStore>

describe("resolvePayloadPath", () => {
  test("resolves top-level field", () => {
    expect(resolvePayloadPath({ name: "hello" }, "name")).toBe("hello")
  })
  test("resolves nested dot-path", () => {
    expect(resolvePayloadPath({ document: { title: "Hi" } }, "document.title")).toBe("Hi")
  })
  test("returns undefined for missing path", () => {
    expect(resolvePayloadPath({ a: 1 }, "b.c")).toBeUndefined()
  })
  test("strips payload. prefix", () => {
    expect(resolvePayloadPath({ document: { title: "Hi" } }, "payload.document.title")).toBe("Hi")
  })
})

describe("interpolate", () => {
  test("replaces {{field}} with payload value", () => {
    expect(interpolate("Hello {{name}}", { name: "World" })).toBe("Hello World")
  })
  test("replaces nested {{payload.document.title}}", () => {
    expect(interpolate("Title: {{payload.document.title}}", { document: { title: "Hi" } })).toBe(
      "Title: Hi",
    )
  })
  test("leaves unknown placeholders empty", () => {
    expect(interpolate("{{missing}}", {})).toBe("")
  })
  test("handles multiple placeholders", () => {
    expect(interpolate("{{a}} and {{b}}", { a: "X", b: "Y" })).toBe("X and Y")
  })
})

describe("evaluateCondition", () => {
  const payload = { category: "news", count: 5, title: "Hello World", active: true }
  test("eq operator", () => {
    expect(evaluateCondition({ field: "category", operator: "eq", value: "news" }, payload)).toBe(
      true,
    )
    expect(evaluateCondition({ field: "category", operator: "eq", value: "blog" }, payload)).toBe(
      false,
    )
  })
  test("neq operator", () => {
    expect(evaluateCondition({ field: "category", operator: "neq", value: "blog" }, payload)).toBe(
      true,
    )
  })
  test("contains operator", () => {
    expect(
      evaluateCondition({ field: "title", operator: "contains", value: "World" }, payload),
    ).toBe(true)
    expect(evaluateCondition({ field: "title", operator: "contains", value: "xyz" }, payload)).toBe(
      false,
    )
  })
  test("not_contains operator", () => {
    expect(
      evaluateCondition({ field: "title", operator: "not_contains", value: "xyz" }, payload),
    ).toBe(true)
  })
  test("gt operator", () => {
    expect(evaluateCondition({ field: "count", operator: "gt", value: 3 }, payload)).toBe(true)
    expect(evaluateCondition({ field: "count", operator: "gt", value: 10 }, payload)).toBe(false)
  })
  test("lt operator", () => {
    expect(evaluateCondition({ field: "count", operator: "lt", value: 10 }, payload)).toBe(true)
  })
  test("matches operator (regex)", () => {
    expect(
      evaluateCondition({ field: "title", operator: "matches", value: "^Hello" }, payload),
    ).toBe(true)
    expect(evaluateCondition({ field: "title", operator: "matches", value: "^Bye" }, payload)).toBe(
      false,
    )
  })
})

describe("flow engine", () => {
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

  test("executes a single log action step", async () => {
    const flow = store.createFlow({
      name: "Test",
      trigger: { type: "content.created" },
      steps: [
        {
          id: "s1",
          type: "action.log",
          config: { message: "Doc created: {{document.title}}" },
          next: null,
        },
      ],
    })
    const engine = createFlowEngine(store)
    const runId = await engine.executeFlow(flow, {
      event: "content.created",
      document: { title: "Hello" },
    })
    const run = store.getRun(runId)
    expect(run!.status).toBe("completed")
    const steps = store.getRunSteps(runId)
    expect(steps).toHaveLength(1)
    expect(steps[0].status).toBe("completed")
    expect(JSON.parse(steps[0].output!).message).toBe("Doc created: Hello")
  })

  test("evaluates condition and takes true branch", async () => {
    const flow = store.createFlow({
      name: "Branch test",
      trigger: { type: "content.created" },
      steps: [
        {
          id: "s1",
          type: "condition",
          rules: [{ field: "document.category", operator: "eq", value: "news" }],
          match: "all",
          branches: { true: "s2", false: "s3" },
        },
        { id: "s2", type: "action.log", config: { message: "Is news" }, next: null },
        { id: "s3", type: "action.log", config: { message: "Not news" }, next: null },
      ],
    })
    const engine = createFlowEngine(store)
    const runId = await engine.executeFlow(flow, {
      event: "content.created",
      document: { category: "news" },
    })
    const steps = store.getRunSteps(runId)
    expect(steps).toHaveLength(2)
    expect(steps[0].branch_taken).toBe("true")
    expect(JSON.parse(steps[1].output!).message).toBe("Is news")
  })

  test("evaluates condition and takes false branch", async () => {
    const flow = store.createFlow({
      name: "Branch test",
      trigger: { type: "content.created" },
      steps: [
        {
          id: "s1",
          type: "condition",
          rules: [{ field: "document.category", operator: "eq", value: "news" }],
          match: "all",
          branches: { true: "s2", false: "s3" },
        },
        { id: "s2", type: "action.log", config: { message: "Is news" }, next: null },
        { id: "s3", type: "action.log", config: { message: "Not news" }, next: null },
      ],
    })
    const engine = createFlowEngine(store)
    const runId = await engine.executeFlow(flow, {
      event: "content.created",
      document: { category: "blog" },
    })
    const steps = store.getRunSteps(runId)
    expect(steps).toHaveLength(2)
    expect(steps[0].branch_taken).toBe("false")
    expect(JSON.parse(steps[1].output!).message).toBe("Not news")
  })

  test("transform action reshapes payload via mappings", async () => {
    const flow = store.createFlow({
      name: "Transform test",
      trigger: { type: "content.created" },
      steps: [
        {
          id: "s1",
          type: "action.transform",
          config: { mappings: { title: "document.title", slug: "document.slug" } },
          next: "s2",
        },
        { id: "s2", type: "action.log", config: { message: "Title is {{title}}" }, next: null },
      ],
    })
    const engine = createFlowEngine(store)
    const runId = await engine.executeFlow(flow, {
      event: "content.created",
      document: { title: "Hi", slug: "hi" },
    })
    const steps = store.getRunSteps(runId)
    expect(steps).toHaveLength(2)
    const transformOutput = JSON.parse(steps[0].output!)
    expect(transformOutput.title).toBe("Hi")
    expect(transformOutput.slug).toBe("hi")
  })

  test("condition with match:any passes if any rule matches", async () => {
    const flow = store.createFlow({
      name: "Any test",
      trigger: { type: "content.created" },
      steps: [
        {
          id: "s1",
          type: "condition",
          match: "any",
          rules: [
            { field: "document.category", operator: "eq", value: "news" },
            { field: "document.category", operator: "eq", value: "blog" },
          ],
          branches: { true: "s2", false: null },
        },
        { id: "s2", type: "action.log", config: { message: "matched" }, next: null },
      ],
    })
    const engine = createFlowEngine(store)
    const runId = await engine.executeFlow(flow, {
      event: "content.created",
      document: { category: "blog" },
    })
    const steps = store.getRunSteps(runId)
    expect(steps[0].branch_taken).toBe("true")
  })

  test("failed action marks run as failed", async () => {
    const flow = store.createFlow({
      name: "Fail test",
      trigger: { type: "content.created" },
      steps: [
        {
          id: "s1",
          type: "action.webhook",
          config: { url: "http://localhost:99999/doesnotexist", method: "POST" },
          next: null,
        },
      ],
    })
    const engine = createFlowEngine(store, { webhookRetryDelays: [] })
    const runId = await engine.executeFlow(flow, { event: "content.created", document: {} })
    const run = store.getRun(runId)
    expect(run!.status).toBe("failed")
  })

  test("empty steps flow completes immediately", async () => {
    const flow = store.createFlow({
      name: "Empty",
      trigger: { type: "content.created" },
      steps: [],
    })
    const engine = createFlowEngine(store)
    const runId = await engine.executeFlow(flow, { event: "content.created" })
    const run = store.getRun(runId)
    expect(run!.status).toBe("completed")
  })

  test("retryRun replays a failed run payload as a new run", async () => {
    const flow = store.createFlow({
      name: "Retry test",
      trigger: { type: "content.created" },
      steps: [
        {
          id: "s1",
          type: "action.log",
          config: { message: "Retry {{document.title}}" },
          next: null,
        },
      ],
    })
    const failed = store.createRun(
      flow.id,
      "content.created",
      JSON.stringify({
        event: "content.created",
        document: { title: "Original payload" },
      }),
    )
    store.completeRun(failed.id, "failed", "Temporary failure")

    const engine = createFlowEngine(store)
    const retryRunId = await engine.retryRun(flow, failed.id)
    const retryRun = store.getRun(retryRunId)
    const retrySteps = store.getRunSteps(retryRunId)

    expect(retryRunId).not.toBe(failed.id)
    expect(retryRun!.status).toBe("completed")
    expect(JSON.parse(retrySteps[0].output!).message).toBe("Retry Original payload")
  })
})
