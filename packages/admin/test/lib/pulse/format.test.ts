import { describe, expect, test } from "bun:test"
import { countdown, relativeTime } from "../../../src/lib/pulse/format"

const NOW = Date.parse("2026-06-14T12:00:00.000Z")

describe("relativeTime", () => {
  test("compact buckets from now to days", () => {
    expect(relativeTime("2026-06-14T11:59:58.000Z", NOW)).toBe("now") // <5s
    expect(relativeTime("2026-06-14T11:59:50.000Z", NOW)).toBe("10s")
    expect(relativeTime("2026-06-14T11:45:00.000Z", NOW)).toBe("15m")
    expect(relativeTime("2026-06-14T09:00:00.000Z", NOW)).toBe("3h")
    expect(relativeTime("2026-06-11T12:00:00.000Z", NOW)).toBe("3d")
  })

  test("invalid date is empty string", () => {
    expect(relativeTime("nope", NOW)).toBe("")
  })
})

describe("countdown", () => {
  test("HH:MM:SS to a future time, clamped at zero", () => {
    expect(countdown("2026-06-14T14:14:09.000Z", NOW)).toBe("02:14:09")
    expect(countdown("2026-06-14T11:00:00.000Z", NOW)).toBe("00:00:00")
    expect(countdown("bad", NOW)).toBe("00:00:00")
  })
})
