import { describe, expect, test } from "bun:test"
import { allTags, filterByTag } from "../../../src/lib/media/tags"

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

describe("filterByTag", () => {
  test("returns all items when the tag is null", () => {
    expect(filterByTag(items as any, null)).toHaveLength(3)
  })

  test("returns only items carrying the tag", () => {
    expect(filterByTag(items as any, "hero").map((item) => item.id)).toEqual(["a"])
    expect(filterByTag(items as any, "2024").map((item) => item.id)).toEqual(["a", "b"])
    expect(filterByTag(items as any, "missing")).toEqual([])
  })
})
