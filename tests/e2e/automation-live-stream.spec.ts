import type { E2EContext } from "./agent-browser-e2e"

type FlowRecord = { id: string }

/**
 * Verifies live run streaming end-to-end through the fully wired server:
 * an authenticated admin opens the SSE feed at /api/_flows/runs/stream, a real
 * (non-dry) run is triggered, and the server pushes run.started / run.step /
 * run.completed frames over HTTP. This exercises the index.ts bus wiring and
 * the requireAdmin gate that the in-process handler tests do not cover.
 */
export async function runAutomationLiveStreamSmoke(ctx: E2EContext) {
  const stamp = Date.now()

  // An ACTIVE webhook flow so POST /trigger runs it for real (live, not dry).
  const flow = await ctx.apiJson<FlowRecord>("/api/_flows", {
    method: "POST",
    body: JSON.stringify({
      name: `Live Stream Demo ${stamp}`,
      active: true,
      trigger: { type: "webhook.received" },
      steps: [
        { id: "s1", type: "action.log", config: { message: "received {{value}}" }, next: "s2" },
        { id: "s2", type: "action.transform", config: { mappings: { echo: "value" } }, next: null },
      ],
    }),
  })

  // Open the SSE stream filtered to this flow, using the authenticated cookie.
  const res = await fetch(`${ctx.apiBase}/api/_flows/runs/stream?flowId=${flow.id}`, {
    headers: { Cookie: ctx.cookieHeader, Accept: "text/event-stream" },
  })
  if (res.status !== 200) {
    throw new Error(`SSE stream returned ${res.status}, expected 200`)
  }
  if (!res.headers.get("Content-Type")?.includes("text/event-stream")) {
    throw new Error(
      `SSE stream Content-Type was "${res.headers.get("Content-Type")}", expected text/event-stream`,
    )
  }
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()

  let buf = ""
  const eventFrameCount = () => buf.split("\n\n").filter((f) => f.startsWith("event:")).length
  const readUntil = async (predicate: () => boolean, timeoutMs = 5000): Promise<void> => {
    const stop = Date.now() + timeoutMs
    while (!predicate() && Date.now() < stop) {
      const { value, done } = await reader.read()
      if (done) break
      if (value) buf += decoder.decode(value, { stream: true })
    }
  }

  // Read until the ": connected" preamble, so the subscription is live before we
  // trigger the run (no missed events).
  await readUntil(() => buf.includes(": connected"))
  if (!buf.includes(": connected")) {
    throw new Error("SSE stream did not send the ': connected' preamble")
  }

  // Trigger the flow for real.
  await ctx.apiJson(`/api/_flows/${flow.id}/trigger`, {
    method: "POST",
    body: JSON.stringify({ value: "Hello Stream" }),
  })

  // Expect three event frames: started, the steps, completed.
  await readUntil(() => eventFrameCount() >= 3)
  await reader.cancel().catch(() => {})

  for (const expected of ["event: run.started", "event: run.step", "event: run.completed"]) {
    if (!buf.includes(expected)) {
      throw new Error(`SSE stream did not deliver "${expected}". Got:\n${buf}`)
    }
  }
  if (!buf.includes(flow.id)) {
    throw new Error("SSE frames did not reference the triggered flow id")
  }

  // The persisted run should now be queryable and completed.
  const runs = await ctx.apiJson<{ data: Array<{ status: string }> }>(`/api/_flows/${flow.id}/runs`)
  if (runs.data.length === 0) {
    throw new Error("Triggered run was not persisted")
  }

  return {
    name: "Automation live run streaming smoke",
    details: [
      `Created active webhook flow ${flow.id} (log + transform).`,
      "Opened the SSE feed at /api/_flows/runs/stream and saw the connected preamble.",
      "Triggered a real run; the server pushed run.started, run.step, and run.completed frames over HTTP.",
      "Confirmed the run persisted via the runs API.",
    ],
  }
}
