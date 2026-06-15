import { afterEach, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import {
  bootstrapTables,
  createAuditLogStore,
  createDatabase,
  createRunEventBus,
  type RunEvent,
} from "@not-a-cms/core"
import { createPulseHandler } from "../../src/pulse/handler"

const testDbPath = "test-server-pulse.db"

function setup() {
  const db = createDatabase({ url: testDbPath })
  bootstrapTables(db, [])
  const audit = createAuditLogStore(db)
  const runEvents = createRunEventBus()
  const handler = createPulseHandler(audit, runEvents)
  return { audit, runEvents, handler }
}

afterEach(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      unlinkSync(testDbPath + suffix)
    } catch {}
  }
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

describe("GET /api/_pulse", () => {
  test("returns a text/event-stream response with an initial heartbeat", async () => {
    const { handler } = setup()
    const res = await handler(new Request("http://localhost/api/_pulse"))
    expect(res?.status).toBe(200)
    expect(res?.headers.get("Content-Type")).toBe("text/event-stream")
    const reader = res!.body!.getReader()
    const text = await readFrames(reader, 1)
    expect(text).toContain("event: heartbeat")
    expect(text).toContain('"eventsPerMin"')
    await reader.cancel()
  })

  test("streams a pulse frame when an audit event is recorded", async () => {
    const { audit, handler } = setup()
    const res = await handler(new Request("http://localhost/api/_pulse"))
    const reader = res!.body!.getReader()
    const framesPromise = readFrames(reader, 2) // heartbeat (connect) + the pulse
    await new Promise((r) => setTimeout(r, 0))
    audit.record({
      action: "content.workflow.publish",
      collection: "page",
      documentId: "home",
      summary: "Published page",
    })
    const text = await framesPromise
    expect(text).toContain("event: pulse")
    expect(text).toContain("Published page")
    expect(text).toContain("/content/page/home")
    await reader.cancel()
  })

  test("streams an alert frame for a failed automation run", async () => {
    const { runEvents, handler } = setup()
    const res = await handler(new Request("http://localhost/api/_pulse"))
    const reader = res!.body!.getReader()
    const framesPromise = readFrames(reader, 2)
    await new Promise((r) => setTimeout(r, 0))
    runEvents.publish({
      type: "run.completed",
      run: {
        id: "r1",
        flow_id: "f1",
        trigger_event: "content.created",
        status: "failed",
        started_at: "2026-06-15T11:59:00.000Z",
        finished_at: "2026-06-15T12:00:00.000Z",
      },
    } as RunEvent)
    const text = await framesPromise
    expect(text).toContain("event: pulse")
    expect(text).toContain("Automation run failed")
    await reader.cancel()
  })

  test("non-GET methods are rejected", async () => {
    const { handler } = setup()
    const res = await handler(new Request("http://localhost/api/_pulse", { method: "POST" }))
    expect(res?.status).toBe(405)
  })

  test("returns null for unrelated paths", async () => {
    const { handler } = setup()
    const res = await handler(new Request("http://localhost/api/_other"))
    expect(res).toBeNull()
  })

  test("tears down subscriptions on cancel without throwing on later events", async () => {
    const { audit, runEvents, handler } = setup()
    const res = await handler(new Request("http://localhost/api/_pulse"))
    const reader = res!.body!.getReader()
    await readFrames(reader, 1) // initial heartbeat
    await reader.cancel() // triggers stream cancel -> cleanup
    // After teardown, further activity must not throw: subscriptions are removed
    // and any stray enqueue is guarded.
    expect(() =>
      audit.record({ action: "content.updated", collection: "page", documentId: "home" }),
    ).not.toThrow()
    expect(() =>
      runEvents.publish({
        type: "run.completed",
        run: {
          id: "r2",
          flow_id: "f1",
          trigger_event: "content.created",
          status: "completed",
          started_at: "2026-06-15T12:00:00.000Z",
          finished_at: "2026-06-15T12:00:01.000Z",
        },
      } as RunEvent),
    ).not.toThrow()
  })
})
