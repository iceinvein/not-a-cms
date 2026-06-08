import { describe, expect, test } from "bun:test"
import { runToTimeline } from "../../../src/lib/automations/timeline"

describe("runToTimeline", () => {
  test("orders steps, computes durations, surfaces the failing step", () => {
    const tl = runToTimeline({
      id: "r",
      flow_id: "f",
      trigger_event: "content.published",
      status: "failed",
      started_at: "2026-06-01T10:00:00.000Z",
      finished_at: "2026-06-01T10:00:02.100Z",
      error: "render failed",
      steps: [
        {
          id: "s1",
          run_id: "r",
          step_id: "a1",
          status: "completed",
          started_at: "2026-06-01T10:00:00.000Z",
          finished_at: "2026-06-01T10:00:00.800Z",
          input: "{}",
          output: "{}",
        },
        {
          id: "s2",
          run_id: "r",
          step_id: "a2",
          status: "failed",
          started_at: "2026-06-01T10:00:00.800Z",
          finished_at: "2026-06-01T10:00:02.100Z",
          error: "render failed",
        },
      ],
    } as any)
    expect(tl.steps.map((s) => s.stepId)).toEqual(["a1", "a2"])
    expect(tl.steps[0].durationMs).toBe(800)
    expect(tl.failingStepId).toBe("a2")
    expect(tl.totalMs).toBe(2100)
  })
})
