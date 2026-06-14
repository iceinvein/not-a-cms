import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { Wire } from "../../../src/components/pulse/Wire"
import type { PulseEvent } from "../../../src/lib/pulse/types"

const NOW = Date.parse("2026-06-14T12:00:00.000Z")

const events: PulseEvent[] = [
  {
    id: "a",
    type: "publish",
    actor: "Maya",
    summary: "published Pricing page",
    at: "2026-06-14T11:59:58.000Z",
  },
  {
    id: "b",
    type: "edit",
    actor: "James",
    summary: "is editing Launch announcement",
    at: "2026-06-14T11:49:00.000Z",
  },
  { id: "c", type: "alert", summary: "Automation Sync CDN failed", at: "2026-06-14T11:57:00.000Z" },
]

describe("Wire", () => {
  test("renders events with actor, summary, relative time and type class", () => {
    const html = renderToString(<Wire events={events} now={NOW} />)
    expect(html).toContain("Maya")
    expect(html).toContain("published Pricing page")
    expect(html).toContain("11m") // James edit, 11 minutes ago
    expect(html).toContain("pulse-wire-dot-alert")
    expect(html).toContain('aria-label="Live activity"')
    expect(html).not.toContain("aria-live")
  })

  test("caps the number of items shown", () => {
    const many: PulseEvent[] = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      type: "edit",
      actor: "Maya",
      summary: `change ${i}`,
      at: "2026-06-14T11:00:00.000Z",
    }))
    const html = renderToString(<Wire events={many} now={NOW} max={3} />)
    expect(html).toContain("change 0")
    expect(html).toContain("change 2")
    expect(html).not.toContain("change 3")
  })
})
