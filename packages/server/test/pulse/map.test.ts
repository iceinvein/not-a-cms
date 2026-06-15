import { describe, expect, test } from "bun:test"
import type { AuditEvent, RunEvent } from "@not-a-cms/core"
import { auditToPulse, runToPulse } from "../../src/pulse/map"

function auditEvent(overrides: Partial<AuditEvent>): AuditEvent {
  return {
    id: "a1",
    action: "content.updated",
    actorId: "u1",
    actorRole: "editor",
    collection: "page",
    documentId: "home",
    summary: null,
    before: null,
    after: null,
    createdAt: "2026-06-15T12:00:00.000Z",
    ...overrides,
  }
}

describe("auditToPulse", () => {
  test("a publish action maps to type 'publish' with a content href", () => {
    const out = auditToPulse(auditEvent({ action: "content.workflow.publish" }))
    expect(out.type).toBe("publish")
    expect(out.href).toBe("/content/page/home")
    expect(out.at).toBe("2026-06-15T12:00:00.000Z")
    expect(out.id).toBe("a1")
  })

  test("non-publish actions map to 'edit'", () => {
    expect(auditToPulse(auditEvent({ action: "content.updated" })).type).toBe("edit")
    expect(auditToPulse(auditEvent({ action: "content.deleted" })).type).toBe("edit")
  })

  test("uses the recorded summary when present, else derives one", () => {
    expect(auditToPulse(auditEvent({ summary: "Published page" })).summary).toBe("Published page")
    expect(auditToPulse(auditEvent({ action: "content.created", summary: null })).summary).toBe(
      "Created page",
    )
  })

  test("no href when collection or document is missing", () => {
    expect(auditToPulse(auditEvent({ documentId: null })).href).toBeNull()
  })

  test("unpublish is an edit, not a publish", () => {
    expect(auditToPulse(auditEvent({ action: "content.workflow.unpublish" })).type).toBe("edit")
  })

  test("bulk workflow publish is still a publish", () => {
    expect(auditToPulse(auditEvent({ action: "content.bulk.workflow.publish" })).type).toBe(
      "publish",
    )
  })

  test("derives a 'Published' summary for a summary-less publish", () => {
    expect(
      auditToPulse(auditEvent({ action: "content.workflow.publish", summary: null })).summary,
    ).toBe("Published page")
  })
})

describe("runToPulse", () => {
  const baseRun = {
    id: "r1",
    flow_id: "f1",
    trigger_event: "content.created",
    started_at: "2026-06-15T11:59:00.000Z",
    finished_at: "2026-06-15T12:00:00.000Z",
  }

  test("a completed ok run maps to type 'run'", () => {
    const out = runToPulse({
      type: "run.completed",
      run: { ...baseRun, status: "completed" },
    } as RunEvent)
    expect(out?.type).toBe("run")
    expect(out?.at).toBe("2026-06-15T12:00:00.000Z")
  })

  test("a failed run maps to type 'alert'", () => {
    const out = runToPulse({
      type: "run.completed",
      run: { ...baseRun, status: "failed" },
    } as RunEvent)
    expect(out?.type).toBe("alert")
    expect(out?.summary).toBe("Automation run failed")
  })

  test("non-completion run events are ignored", () => {
    expect(
      runToPulse({ type: "run.started", run: { ...baseRun, status: "running" } } as RunEvent),
    ).toBeNull()
  })
})
