import { afterEach, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import {
  bootstrapTables,
  createDatabase,
  createFlowEngine,
  createFlowStore,
  createRunEventBus,
} from "@not-a-cms/core"
import { createAutomationHandler } from "../../src/automations/handler"

const testDbPath = "test-server-run-stream.db"

function setup() {
  const db = createDatabase({ url: testDbPath })
  bootstrapTables(db, [])
  const store = createFlowStore(db)
  const events = createRunEventBus()
  const engine = createFlowEngine(store, { onRunEvent: events.publish })
  const handler = createAutomationHandler(store, engine, events)
  return { store, engine, handler }
}

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

async function readFrames(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  want: number,
  timeoutMs = 2000,
): Promise<string> {
  const decoder = new TextDecoder()
  let buf = ""
  const deadline = Date.now() + timeoutMs
  const count = () => buf.split("\n\n").filter((f) => f.startsWith("event:")).length
  while (count() < want && Date.now() < deadline) {
    const { value, done } = await reader.read()
    if (done) break
    if (value) buf += decoder.decode(value, { stream: true })
  }
  return buf
}

describe("GET /api/_flows/runs/stream", () => {
  test("returns 503 when no event bus is configured", async () => {
    const db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [])
    const store = createFlowStore(db)
    const handler = createAutomationHandler(store, createFlowEngine(store, {}))
    const res = await handler(new Request("http://localhost/api/_flows/runs/stream"))
    expect(res?.status).toBe(503)
  })

  test("returns a text/event-stream response", async () => {
    const { handler } = setup()
    const res = await handler(new Request("http://localhost/api/_flows/runs/stream"))
    expect(res?.status).toBe(200)
    expect(res?.headers.get("Content-Type")).toBe("text/event-stream")
    await res?.body?.cancel()
  })

  test("streams started/step/completed frames for a triggered run", async () => {
    const { store, engine, handler } = setup()
    const flow = store.createFlow({
      name: "Stream",
      trigger: { type: "content.created" },
      steps: [{ id: "a1", type: "action.log", config: { message: "hi" }, next: null }],
    })
    const res = await handler(new Request("http://localhost/api/_flows/runs/stream"))
    const reader = res!.body!.getReader()
    // Begin consuming before triggering so the subscription is definitely live.
    const framesPromise = readFrames(reader, 3)
    await new Promise((r) => setTimeout(r, 0))
    await engine.executeFlow(flow, { event: "content.created", document: { title: "X" } })

    const text = await framesPromise
    expect(text).toContain("event: run.started")
    expect(text).toContain("event: run.step")
    expect(text).toContain("event: run.completed")
    await reader.cancel()
  })

  test("?flowId filters to the matching flow only", async () => {
    const { store, engine, handler } = setup()
    const flowA = store.createFlow({
      name: "A",
      trigger: { type: "content.created" },
      steps: [{ id: "a1", type: "action.log", config: { message: "a" }, next: null }],
    })
    const flowB = store.createFlow({
      name: "B",
      trigger: { type: "content.created" },
      steps: [{ id: "b1", type: "action.log", config: { message: "b" }, next: null }],
    })
    const res = await handler(
      new Request(`http://localhost/api/_flows/runs/stream?flowId=${flowB.id}`),
    )
    const reader = res!.body!.getReader()
    const framesPromise = readFrames(reader, 3)
    await new Promise((r) => setTimeout(r, 0))
    await engine.executeFlow(flowA, { event: "content.created" })
    await engine.executeFlow(flowB, { event: "content.created" })

    const text = await framesPromise
    expect(text).toContain(flowB.id)
    expect(text).not.toContain(flowA.id)
    await reader.cancel()
  })
})
