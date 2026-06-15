import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { PulseSpineView } from "../../../src/components/pulse/PulseSpineView"

const NOW = Date.parse("2026-06-15T12:00:00.000Z")

describe("PulseSpineView", () => {
  test("composes heartbeat, ticker, and presence from props", () => {
    const html = renderToString(
      <PulseSpineView
        eventsPerMin={6}
        latestEvent={{ id: "1", type: "publish", actor: null, summary: "Published page", at: "2026-06-15T11:59:58.000Z" }}
        people={[{ id: "Maya", name: "Maya", color: "#6ea8fe" }]}
        now={NOW}
      />,
    )
    expect(html).toContain("brisk · 6/min") // heartbeat: activityLevel(6) === brisk
    expect(html).toContain("Published page") // ticker
    expect(html).toContain(">M<") // presence avatar initial
  })

  test("before any heartbeat (null rate) it reads idle with no rate, and hides empty presence", () => {
    const html = renderToString(
      <PulseSpineView eventsPerMin={null} latestEvent={null} people={[]} now={NOW} />,
    )
    expect(html).toContain("idle")
    expect(html).not.toContain("/min")
    expect(html).toContain("All quiet")
    expect(html).not.toContain("pulse-presence")
  })
})
