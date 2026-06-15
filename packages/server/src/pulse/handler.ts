import type { AuditLogStore, RunEvent, RunEventBus } from "@not-a-cms/core"
import { auditToPulse, runToPulse } from "./map"

const WINDOW_MS = 60_000
const HEARTBEAT_MS = 5_000
const PING_MS = 25_000

/** Server-Sent-Events endpoint for the admin's living layer. Emits `pulse`
 *  frames (mapped content + automation events) and periodic `heartbeat` frames
 *  carrying the trailing-60s events-per-minute rate. */
export function createPulseHandler(auditLog: AuditLogStore, runEvents: RunEventBus) {
  return async function handler(req: Request): Promise<Response | null> {
    const url = new URL(req.url)
    if (url.pathname !== "/api/_pulse") return null
    if (req.method.toUpperCase() !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      })
    }

    const encoder = new TextEncoder()
    let unsubAudit: (() => void) | null = null
    let unsubRuns: (() => void) | null = null
    let heartbeat: ReturnType<typeof setInterval> | null = null
    let ping: ReturnType<typeof setInterval> | null = null

    // Trailing-window timestamps used to compute the events-per-minute rate.
    const recent: number[] = []
    const rate = (now: number): number => {
      while (recent.length > 0 && now - recent[0] > WINDOW_MS) recent.shift()
      return recent.length
    }

    const cleanup = () => {
      unsubAudit?.()
      unsubAudit = null
      unsubRuns?.()
      unsubRuns = null
      if (heartbeat) {
        clearInterval(heartbeat)
        heartbeat = null
      }
      if (ping) {
        clearInterval(ping)
        ping = null
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
        const sendEvent = (name: string, data: unknown) => {
          send(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)
        }
        const emitHeartbeat = () => {
          sendEvent("heartbeat", { eventsPerMin: rate(Date.now()) })
        }

        // Seed the rate window from recent audit history so the first heartbeat
        // reflects real activity instead of starting cold at zero.
        const cutoff = Date.now() - WINDOW_MS
        for (const e of auditLog.list({ limit: 100 })) {
          const t = Date.parse(e.createdAt)
          if (!Number.isNaN(t) && t >= cutoff) recent.push(t)
        }
        recent.sort((a, b) => a - b)

        send(`: connected\n\n`)
        emitHeartbeat()

        unsubAudit = auditLog.subscribe((e) => {
          recent.push(Date.now())
          sendEvent("pulse", auditToPulse(e))
        })
        unsubRuns = runEvents.subscribe((e: RunEvent) => {
          const mapped = runToPulse(e)
          if (!mapped) return
          recent.push(Date.now())
          sendEvent("pulse", mapped)
        })

        heartbeat = setInterval(emitHeartbeat, HEARTBEAT_MS)
        ping = setInterval(() => send(`: ping\n\n`), PING_MS)

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
}
