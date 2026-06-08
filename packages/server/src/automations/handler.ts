import type { FlowEngine, FlowRunStatus, FlowStore, RunEvent, RunEventBus } from "@not-a-cms/core"

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export function createAutomationHandler(
  store: FlowStore,
  engine: FlowEngine,
  events?: RunEventBus,
) {
  return async function handler(req: Request): Promise<Response | null> {
    const url = new URL(req.url)
    const pathname = url.pathname

    if (!pathname.startsWith("/api/_flows")) {
      return null
    }

    // Parse segments after /api/_flows
    const rest = pathname.slice("/api/_flows".length)
    const segments = rest.split("/").filter(Boolean)
    const method = req.method.toUpperCase()

    try {
      // GET /api/_flows — list all flows
      if (segments.length === 0 && method === "GET") {
        return json({ data: store.listFlows() })
      }

      // POST /api/_flows — create flow
      if (segments.length === 0 && method === "POST") {
        const body = await req.json()
        const flow = store.createFlow(body)
        return json(flow, 201)
      }

      // GET /api/_flows/runs — list runs across all flows
      if (segments.length === 1 && segments[0] === "runs" && method === "GET") {
        const status = url.searchParams.get("status") as FlowRunStatus | null
        const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : 50
        const offset = url.searchParams.has("offset") ? Number(url.searchParams.get("offset")) : 0
        return json({
          data: store.listRecentRuns({ status: status ?? undefined, limit, offset }),
        })
      }

      // GET /api/_flows/runs/stream: Server-Sent Events feed of live run progress
      if (
        segments.length === 2 &&
        segments[0] === "runs" &&
        segments[1] === "stream" &&
        method === "GET"
      ) {
        if (!events) return json({ error: "Streaming not available" }, 503)
        const flowFilter = url.searchParams.get("flowId")
        const encoder = new TextEncoder()
        let unsubscribe: (() => void) | null = null
        let heartbeat: ReturnType<typeof setInterval> | null = null

        const flowIdOf = (event: RunEvent): string =>
          event.type === "run.step" ? event.flowId : event.run.flow_id

        const cleanup = () => {
          unsubscribe?.()
          unsubscribe = null
          if (heartbeat) {
            clearInterval(heartbeat)
            heartbeat = null
          }
        }

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const send = (chunk: string) => {
              try {
                controller.enqueue(encoder.encode(chunk))
              } catch {
                /* controller closed */
              }
            }
            unsubscribe = events.subscribe((event) => {
              if (flowFilter && flowIdOf(event) !== flowFilter) return
              send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
            })
            send(`: connected\n\n`)
            heartbeat = setInterval(() => send(`: ping\n\n`), 25000)
            req.signal.addEventListener("abort", () => {
              cleanup()
              try {
                controller.close()
              } catch {
                /* already closed */
              }
            })
          },
          cancel() {
            cleanup()
          },
        })

        return new Response(stream, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        })
      }

      // POST /api/_flows/dry-run: simulate a flow without side effects (ephemeral)
      if (segments.length === 1 && segments[0] === "dry-run" && method === "POST") {
        let body: any = {}
        try {
          body = await req.json()
        } catch {}
        const flow = body?.flow
        if (!flow || typeof flow !== "object" || !flow.trigger || !Array.isArray(flow.steps)) {
          return json({ error: "A flow with a trigger and steps is required" }, 400)
        }
        const payload =
          body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
            ? (body.payload as Record<string, unknown>)
            : { event: flow.trigger.type }
        const result = await engine.dryRun(flow, payload)
        return json(result)
      }

      const id = segments[0]

      // POST /api/_flows/:id/trigger — inbound webhook trigger
      if (segments.length === 2 && segments[1] === "trigger" && method === "POST") {
        const flow = store.getFlowById(id)
        if (!flow) return json({ error: "Flow not found" }, 404)
        if (!flow.active) return json({ error: "Flow is not active" }, 400)
        if (flow.trigger.type !== "webhook.received") {
          return json({ error: "Flow trigger is not webhook.received" }, 400)
        }
        let payload: Record<string, unknown> = {}
        try {
          payload = await req.json()
        } catch {}
        const runId = await engine.executeFlow(flow, { event: "webhook.received", ...payload })
        return json({ runId })
      }

      // POST /api/_flows/:id/toggle — toggle active state
      if (segments.length === 2 && segments[1] === "toggle" && method === "POST") {
        const flow = store.toggleFlow(id)
        if (!flow) return json({ error: "Flow not found" }, 404)
        return json(flow)
      }

      // DELETE /api/_flows/:id/runs — purge runs for a flow
      if (segments.length === 2 && segments[1] === "runs" && method === "DELETE") {
        const flow = store.getFlowById(id)
        if (!flow) return json({ error: "Flow not found" }, 404)
        // purgeOldRuns(0) removes runs older than 0 days (effectively all runs)
        const purged = store.purgeOldRuns(0)
        return json({ purged })
      }

      // GET /api/_flows/:id/runs — list runs (paginated)
      if (segments.length === 2 && segments[1] === "runs" && method === "GET") {
        const flow = store.getFlowById(id)
        if (!flow) return json({ error: "Flow not found" }, 404)
        const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : 50
        const offset = url.searchParams.has("offset") ? Number(url.searchParams.get("offset")) : 0
        const runs = store.listRuns(id, limit, offset)
        return json({ data: runs })
      }

      // POST /api/_flows/:id/runs/:runId/retry — replay a failed run
      if (
        segments.length === 4 &&
        segments[1] === "runs" &&
        segments[3] === "retry" &&
        method === "POST"
      ) {
        const flow = store.getFlowById(id)
        if (!flow) return json({ error: "Flow not found" }, 404)
        const retryRunId = await engine.retryRun(flow, segments[2])
        return json({ runId: retryRunId })
      }

      // GET /api/_flows/:id/runs/:runId — get run detail with steps
      if (segments.length === 3 && segments[1] === "runs" && method === "GET") {
        const runId = segments[2]
        const run = store.getRun(runId)
        if (!run) return json({ error: "Run not found" }, 404)
        const steps = store.getRunSteps(runId)
        return json({ ...run, steps })
      }

      // GET /api/_flows/:id — get flow
      if (segments.length === 1 && method === "GET") {
        const flow = store.getFlowById(id)
        if (!flow) return json({ error: "Flow not found" }, 404)
        return json(flow)
      }

      // PATCH /api/_flows/:id — update flow
      if (segments.length === 1 && method === "PATCH") {
        const body = await req.json()
        const flow = store.updateFlow(id, body)
        if (!flow) return json({ error: "Flow not found" }, 404)
        return json(flow)
      }

      // DELETE /api/_flows/:id — delete flow (cascade)
      if (segments.length === 1 && method === "DELETE") {
        const flow = store.getFlowById(id)
        if (!flow) return json({ error: "Flow not found" }, 404)
        store.deleteFlow(id)
        return json({ deleted: true })
      }

      return json({ error: "Not found" }, 404)
    } catch (err: any) {
      return json({ error: err.message || "Internal server error" }, 500)
    }
  }
}
