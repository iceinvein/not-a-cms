import { describe, expect, test } from "bun:test"
import { allTags, filterByTags, filterUntagged, untaggedCount } from "../../../src/lib/media/tags"

const items = [
  { id: "a", filename: "hero.jpg", mimetype: "image/jpeg", size: 1, uploadedAt: "", url: "", tags: ["hero", "2024"] },
  { id: "b", filename: "promo.mp4", mimetype: "video/mp4", size: 1, uploadedAt: "", url: "", tags: ["2024"] },
  { id: "c", filename: "spec.pdf", mimetype: "application/pdf", size: 1, uploadedAt: "", url: "" },
]

describe("allTags", () => {
  test("returns the sorted union of tags with per-asset counts", () => {
    expect(allTags(items as any)).toEqual([
      { tag: "2024", count: 2 },
      { tag: "hero", count: 1 },
    ])
  })

  test("returns an empty list when no asset is tagged", () => {
    expect(allTags([{ id: "x", filename: "", mimetype: "", size: 0, uploadedAt: "", url: "" }] as any)).toEqual([])
  })
})

describe("filterByTags (AND)", () => {
  test("returns all items when no tags are active", () => {
    expect(filterByTags(items as any, [])).toHaveLength(3)
  })

  test("returns items having ALL active tags", () => {
    expect(filterByTags(items as any, ["2024"]).map((i) => i.id)).toEqual(["a", "b"])
    expect(filterByTags(items as any, ["hero", "2024"]).map((i) => i.id)).toEqual(["a"])
    expect(filterByTags(items as any, ["hero", "missing"])).toEqual([])
  })
})

describe("filterUntagged / untaggedCount", () => {
  test("selects items with no tags", () => {
    expect(filterUntagged(items as any).map((i) => i.id)).toEqual(["c"])
    expect(untaggedCount(items as any)).toBe(1)
  })
})
