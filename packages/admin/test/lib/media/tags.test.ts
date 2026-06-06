import { describe, expect, test } from "bun:test"
import { allTags, defaultTagColor, filterByTags, filterUntagged, tagColor, tagPreviewCounts, untaggedCount } from "../../../src/lib/media/tags"

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

describe("filterByTags (OR)", () => {
  test("returns items having ANY active tag", () => {
    expect(filterByTags(items as any, ["hero", "2024"], "or").map((i) => i.id)).toEqual(["a", "b"])
    expect(filterByTags(items as any, ["hero"], "or").map((i) => i.id)).toEqual(["a"])
    expect(filterByTags(items as any, ["missing"], "or")).toEqual([])
  })

  test("empty tags returns all items in either mode", () => {
    expect(filterByTags(items as any, [], "or")).toHaveLength(3)
    expect(filterByTags(items as any, [], "and")).toHaveLength(3)
  })
})

describe("tagPreviewCounts", () => {
  test("with no active tags equals per-tag counts", () => {
    expect(tagPreviewCounts(items as any, [], "and")).toEqual([
      { tag: "2024", count: 2 },
      { tag: "hero", count: 1 },
    ])
  })

  test("AND previews the narrowed size of adding each tag", () => {
    // active ["2024"] -> items a,b. Adding hero -> only a (1). Adding 2024 -> still a,b (2).
    expect(tagPreviewCounts(items as any, ["2024"], "and")).toEqual([
      { tag: "2024", count: 2 },
      { tag: "hero", count: 1 },
    ])
  })

  test("OR previews the union size of adding each tag", () => {
    // active ["hero"] -> item a. OR-adding 2024 -> a,b (2). OR-adding hero -> a (1).
    expect(tagPreviewCounts(items as any, ["hero"], "or")).toEqual([
      { tag: "2024", count: 2 },
      { tag: "hero", count: 1 },
    ])
  })
})

describe("filterUntagged / untaggedCount", () => {
  test("selects items with no tags", () => {
    expect(filterUntagged(items as any).map((i) => i.id)).toEqual(["c"])
    expect(untaggedCount(items as any)).toBe(1)
  })
})

describe("tag colors", () => {
  test("defaultTagColor is deterministic and valid hex", () => {
    expect(defaultTagColor("hero")).toMatch(/^#[0-9a-f]{6}$/i)
    expect(defaultTagColor("hero")).toBe(defaultTagColor("hero"))
  })

  test("tagColor prefers the registry, else default", () => {
    expect(tagColor("hero", { hero: "#abcdef" })).toBe("#abcdef")
    expect(tagColor("hero", {})).toBe(defaultTagColor("hero"))
  })
})
