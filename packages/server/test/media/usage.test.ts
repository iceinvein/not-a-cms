import { describe, expect, test } from "bun:test"
import { computeMediaUsage, computeUsageCounts, mediaColumn } from "../../src/media/usage"

const collections = new Map<string, any>([
  ["post", { def: { name: "post", labels: { plural: "Posts" }, fields: { title: { type: "text" }, cover: { type: "media" }, body: { type: "richText" } } }, table: "post" }],
  ["page", { def: { name: "page", labels: { plural: "Pages" }, fields: { name: { type: "text" }, hero: { type: "media" } } }, table: "page" }],
])

const queryFn = async (table: string, column: string, assetId: string) => {
  if (table === "post" && column === "cover_id" && assetId === "img1") return [{ id: "p1", title: "Launch" }]
  if (table === "page" && column === "hero_id" && assetId === "img1") return [{ id: "pg1", name: "Home" }]
  return []
}

describe("mediaColumn", () => {
  test("snake-cases the field and appends _id", () => {
    expect(mediaColumn("coverImage")).toBe("cover_image_id")
    expect(mediaColumn("cover")).toBe("cover_id")
  })
})

describe("computeMediaUsage", () => {
  test("collects exact media-field references with labels and links", async () => {
    const usage = await computeMediaUsage(collections, "img1", queryFn)
    expect(usage.count).toBe(2)
    const byDoc = Object.fromEntries(usage.references.map((r) => [r.documentId, r]))
    expect(byDoc["p1"]).toMatchObject({ collection: "post", field: "cover", label: "Launch" })
    expect(byDoc["pg1"]).toMatchObject({ collection: "page", field: "hero", label: "Home" })
  })

  test("asset with no references is count 0", async () => {
    expect((await computeMediaUsage(collections, "ghost", queryFn)).count).toBe(0)
  })
})

describe("computeUsageCounts", () => {
  test("returns a per-asset count map across media fields", async () => {
    const countFn = async (table: string, column: string) => {
      if (table === "post" && column === "cover_id") return { img1: 1 }
      if (table === "page" && column === "hero_id") return { img1: 1, img2: 3 }
      return {}
    }
    const counts = await computeUsageCounts(collections, countFn)
    expect(counts["img1"]).toBe(2)
    expect(counts["img2"]).toBe(3)
  })
})
