import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { Heartbeat } from "../../../src/components/pulse/Heartbeat"

describe("Heartbeat", () => {
  test("shows level and rate and is labelled for assistive tech", () => {
    const html = renderToString(<Heartbeat level="brisk" eventsPerMin={6} />)
    expect(html).toContain("brisk · 6/min")
    expect(html).toContain('aria-label="Site activity: brisk · 6/min"')
    expect(html).toContain('role="status"')
    expect(html).toContain("--pulse-beat:1000ms")
  })

  test("omits the rate when not provided", () => {
    const html = renderToString(<Heartbeat level="idle" />)
    expect(html).toContain("idle")
    expect(html).not.toContain("/min")
  })
})
