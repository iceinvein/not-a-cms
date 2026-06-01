import { describe, expect, test } from "bun:test"
import { relativeTime } from "../../../src/lib/desk/relative-time"

const now = new Date("2026-06-01T12:00:00.000Z")

describe("relativeTime", () => {
  test("formats future days and hours", () => {
    expect(relativeTime("2026-06-03T12:00:00.000Z", now)).toBe("in 2 days")
    expect(relativeTime("2026-06-01T15:00:00.000Z", now)).toBe("in 3 hours")
  })
})
