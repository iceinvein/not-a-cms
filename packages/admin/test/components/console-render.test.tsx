import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { Console } from "../../src/components/automations/Console"

const run = {
  id: "r1",
  flow_id: "f1",
  trigger_event: "schedule.cron",
  status: "failed",
  started_at: "2026-06-01T10:00:00.000Z",
  finished_at: "2026-06-01T10:00:02.000Z",
  error: "render failed",
  steps: [
    {
      id: "s2",
      run_id: "r1",
      step_id: "render",
      status: "failed",
      started_at: "2026-06-01T10:00:00.800Z",
      finished_at: "2026-06-01T10:00:02.000Z",
      error: "render failed",
    },
  ],
}

describe("Console", () => {
  test("renders a run feed and an inspector with the failing step", () => {
    const html = renderToString(
      <Console apiBase="" initialRuns={[run] as any} initialSelected={run as any} />,
    )
    expect(html).toContain("failed")
    expect(html).toContain("render")
    expect(html).toContain("scrub")
  })
})
