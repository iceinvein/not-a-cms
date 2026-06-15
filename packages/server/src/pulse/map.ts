import type { AuditEvent, RunEvent } from "@not-a-cms/core"

/** Event type understood by the admin Wire (mirrors the client PulseEvent contract). */
export type PulseFeedEventType = "publish" | "edit" | "run" | "alert"

/** One frame of the live activity feed. Shape matches the admin's lib/pulse PulseEvent. */
export type PulseFeedEvent = {
  id: string
  type: PulseFeedEventType
  actor?: string | null
  summary: string
  href?: string | null
  at: string
}

/** Map a recorded audit event into a feed frame. Actor-name resolution is
 *  deferred (audit carries only actorId/role); the surface can resolve later. */
export function auditToPulse(e: AuditEvent): PulseFeedEvent {
  return {
    id: e.id,
    type: e.action.endsWith(".publish") ? "publish" : "edit",
    actor: null,
    summary: e.summary ?? summarize(e.action, e.collection),
    href: e.collection && e.documentId ? `/content/${e.collection}/${e.documentId}` : null,
    at: e.createdAt,
  }
}

/** Map an automation run event. Only completions surface on the feed; a failed
 *  run is an alert. Returns null for events that should not appear. */
export function runToPulse(e: RunEvent): PulseFeedEvent | null {
  if (e.type !== "run.completed") return null
  const failed = e.run.status === "failed"
  return {
    id: e.run.id,
    type: failed ? "alert" : "run",
    actor: null,
    summary: failed ? "Automation run failed" : "Automation run completed",
    href: null,
    at: e.run.finished_at ?? e.run.started_at,
  }
}

function summarize(action: string, collection: string | null): string {
  const c = collection ?? "content"
  switch (action) {
    case "content.created":
      return `Created ${c}`
    case "content.updated":
      return `Updated ${c}`
    case "content.deleted":
      return `Deleted ${c}`
    case "content.scheduled":
      return `Scheduled ${c}`
    case "content.version.restored":
      return `Restored ${c}`
    default:
      if (action.endsWith(".publish")) return `Published ${c}`
      if (action.startsWith("content.workflow.")) return `Updated ${c} workflow`
      if (action.startsWith("content.bulk.")) return `Bulk-updated ${c}`
      return `Updated ${c}`
  }
}
