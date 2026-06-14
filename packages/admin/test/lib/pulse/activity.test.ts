import { describe, expect, test } from "bun:test"
import { activityLevel, beatIntervalMs } from "../../../src/lib/pulse/activity"

describe("activityLevel", () => {
  test("buckets a trailing events-per-minute rate", () => {
    expect(activityLevel(0)).toBe("idle")
    expect(activityLevel(0.9)).toBe("idle")
    expect(activityLevel(1)).toBe("steady")
    expect(activityLevel(3.9)).toBe("steady")
    expect(activityLevel(4)).toBe("brisk")
    expect(activityLevel(25)).toBe("brisk")
  })

  test("non-finite input is idle", () => {
    expect(activityLevel(Number.NaN)).toBe("idle")
  })
})

describe("beatIntervalMs", () => {
  test("beats faster when busier, never below 1000ms", () => {
    expect(beatIntervalMs("idle")).toBe(2200)
    expect(beatIntervalMs("steady")).toBe(1500)
    expect(beatIntervalMs("brisk")).toBe(1000)
    expect(beatIntervalMs("brisk")).toBeGreaterThanOrEqual(1000)
  })
})
