import { describe, expect, test } from "bun:test"
import type {
  FlowRun,
  FlowRunDetail,
  FlowRunStep,
} from "../../../src/components/automations/flow-types"
import { applyRunCompleted, applyRunStep, upsertRun } from "../../../src/lib/automations/run-stream"

const run = (id: string, status: FlowRun["status"] = "running", finished_at?: string): FlowRun => ({
  id,
  flow_id: "f1",
  trigger_event: "content.created",
  status,
  started_at: "2026-06-05T00:00:00.000Z",
  finished_at,
})
const step = (stepId: string, status: FlowRunStep["status"] = "completed"): FlowRunStep => ({
  id: `row-${stepId}`,
  run_id: "r1",
  step_id: stepId,
  status,
  started_at: "2026-06-05T00:00:00.100Z",
})

describe("upsertRun", () => {
  test("prepends a new run", () => {
    const next = upsertRun([run("r0")], run("r1"))
    expect(next.map((r) => r.id)).toEqual(["r1", "r0"])
  })
  test("updates an existing run in place without reordering", () => {
    const next = upsertRun([run("r1", "running"), run("r0")], run("r1", "completed"))
    expect(next.map((r) => r.id)).toEqual(["r1", "r0"])
    expect(next[0].status).toBe("completed")
  })
  test("caps the feed at the limit", () => {
    const existing = Array.from({ length: 50 }, (_, i) => run(`old-${i}`))
    const next = upsertRun(existing, run("new"), 50)
    expect(next).toHaveLength(50)
    expect(next[0].id).toBe("new")
    expect(next.some((r) => r.id === "old-49")).toBe(false)
  })
})

describe("applyRunStep", () => {
  const selected: FlowRunDetail = { ...run("r1"), steps: [step("c1")] }
  test("appends a new step to the selected run", () => {
    const next = applyRunStep(selected, "r1", step("a1"))
    expect(next!.steps.map((s) => s.step_id)).toEqual(["c1", "a1"])
  })
  test("replaces a step with the same step_id", () => {
    const next = applyRunStep(selected, "r1", step("c1", "failed"))
    expect(next!.steps).toHaveLength(1)
    expect(next!.steps[0].status).toBe("failed")
  })
  test("ignores a step for a different run", () => {
    const next = applyRunStep(selected, "other", step("a1"))
    expect(next).toBe(selected)
  })
  test("is a no-op when nothing is selected", () => {
    expect(applyRunStep(null, "r1", step("a1"))).toBeNull()
  })
})

describe("applyRunCompleted", () => {
  const selected: FlowRunDetail = { ...run("r1"), steps: [step("c1")] }
  test("updates status, finished_at, and error on the selected run", () => {
    const next = applyRunCompleted(selected, run("r1", "failed", "2026-06-05T00:00:02.000Z"))
    expect(next!.status).toBe("failed")
    expect(next!.finished_at).toBe("2026-06-05T00:00:02.000Z")
    expect(next!.steps).toHaveLength(1)
  })
  test("ignores completion for a different run", () => {
    const next = applyRunCompleted(selected, run("other", "completed"))
    expect(next).toBe(selected)
  })
})
