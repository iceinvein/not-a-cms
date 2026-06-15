import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { WireTicker } from "../../../src/components/pulse/WireTicker"

const NOW = Date.parse("2026-06-15T12:00:00.000Z")

describe("WireTicker", () => {
  test("renders the latest event's summary, relative time, and type dot", () => {
    const html = renderToString(
      <WireTicker
        event={{
          id: "1",
          type: "alert",
          summary: "Automation run failed",
          at: "2026-06-15T11:57:00.000Z",
        }}
        now={NOW}
      />,
    )
    expect(html).toContain("Automation run failed")
    expect(html).toContain("3m")
    expect(html).toContain("pulse-wire-dot-alert")
  })

  test("renders a calm idle label when there is no event", () => {
    const html = renderToString(<WireTicker event={null} now={NOW} />)
    expect(html).toContain("All quiet")
    expect(html).not.toContain("pulse-wire-dot-")
  })
})
