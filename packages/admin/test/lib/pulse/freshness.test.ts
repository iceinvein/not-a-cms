import { describe, expect, test } from "bun:test"
import { freshnessIntensity, isDormant } from "../../../src/lib/pulse/freshness"

const NOW = Date.parse("2026-06-14T12:00:00.000Z")

describe("freshnessIntensity", () => {
  test("full at edit time, zero at the window edge, half in the middle", () => {
    expect(freshnessIntensity("2026-06-14T12:00:00.000Z", NOW)).toBe(1)
    expect(freshnessIntensity("2026-06-14T06:00:00.000Z", NOW)).toBe(0) // exactly 6h ago
    const mid = freshnessIntensity("2026-06-14T09:00:00.000Z", NOW) // 3h ago
    expect(mid).toBeGreaterThan(0.49)
    expect(mid).toBeLessThan(0.51)
  })

  test("future timestamps clamp to full, invalid dates are zero", () => {
    expect(freshnessIntensity("2026-06-14T13:00:00.000Z", NOW)).toBe(1)
    expect(freshnessIntensity("not-a-date", NOW)).toBe(0)
  })
})

describe("isDormant", () => {
  test("true once older than the dormant window (default 30d)", () => {
    expect(isDormant("2026-05-01T12:00:00.000Z", NOW)).toBe(true)
    expect(isDormant("2026-06-10T12:00:00.000Z", NOW)).toBe(false)
  })
})
