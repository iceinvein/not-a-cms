import { test, expect, describe } from "bun:test"
import { matchesCron } from "../../src/automations/cron"

describe("matchesCron", () => {
  test("* * * * * matches any time", () => {
    expect(matchesCron("* * * * *", new Date("2026-04-07T10:30:00Z"))).toBe(true)
  })
  test("30 * * * * matches at minute 30", () => {
    expect(matchesCron("30 * * * *", new Date("2026-04-07T10:30:00Z"))).toBe(true)
    expect(matchesCron("30 * * * *", new Date("2026-04-07T10:15:00Z"))).toBe(false)
  })
  test("0 10 * * * matches at hour 10 minute 0", () => {
    expect(matchesCron("0 10 * * *", new Date("2026-04-07T10:00:00Z"))).toBe(true)
    expect(matchesCron("0 10 * * *", new Date("2026-04-07T11:00:00Z"))).toBe(false)
  })
  test("0 0 1 * * matches first day of month", () => {
    expect(matchesCron("0 0 1 * *", new Date("2026-04-01T00:00:00Z"))).toBe(true)
    expect(matchesCron("0 0 1 * *", new Date("2026-04-02T00:00:00Z"))).toBe(false)
  })
  test("*/15 * * * * matches every 15 minutes", () => {
    expect(matchesCron("*/15 * * * *", new Date("2026-04-07T10:00:00Z"))).toBe(true)
    expect(matchesCron("*/15 * * * *", new Date("2026-04-07T10:15:00Z"))).toBe(true)
    expect(matchesCron("*/15 * * * *", new Date("2026-04-07T10:07:00Z"))).toBe(false)
  })
  test("comma-separated values", () => {
    expect(matchesCron("0,30 * * * *", new Date("2026-04-07T10:00:00Z"))).toBe(true)
    expect(matchesCron("0,30 * * * *", new Date("2026-04-07T10:30:00Z"))).toBe(true)
    expect(matchesCron("0,30 * * * *", new Date("2026-04-07T10:15:00Z"))).toBe(false)
  })
})
