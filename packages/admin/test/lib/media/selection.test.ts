import { describe, expect, test } from "bun:test"
import { rangeBetween } from "../../../src/lib/media/selection"

const ordered = ["a", "b", "c", "d", "e"]

describe("rangeBetween", () => {
  test("returns the inclusive slice when the anchor precedes the target", () => {
    expect(rangeBetween(ordered, "b", "d")).toEqual(["b", "c", "d"])
  })

  test("returns the inclusive slice when the anchor follows the target", () => {
    expect(rangeBetween(ordered, "d", "b")).toEqual(["b", "c", "d"])
  })

  test("returns just the target when the anchor is null", () => {
    expect(rangeBetween(ordered, null, "c")).toEqual(["c"])
  })

  test("returns just the target when the anchor is not in the list", () => {
    expect(rangeBetween(ordered, "zzz", "c")).toEqual(["c"])
  })

  test("returns just the target when anchor equals target", () => {
    expect(rangeBetween(ordered, "c", "c")).toEqual(["c"])
  })
})
