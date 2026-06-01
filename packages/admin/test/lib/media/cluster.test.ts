import { describe, expect, test } from "bun:test"
import { clusterAssets, type Cluster } from "../../../src/lib/media/cluster"

const items = [
  { id: "a", filename: "hero.jpg", mimetype: "image/jpeg", size: 1, uploadedAt: "", url: "" },
  { id: "b", filename: "promo.mp4", mimetype: "video/mp4", size: 1, uploadedAt: "", url: "" },
  { id: "c", filename: "spec.pdf", mimetype: "application/pdf", size: 1, uploadedAt: "", url: "" },
  { id: "d", filename: "old.png", mimetype: "image/png", size: 1, uploadedAt: "", url: "" },
]

describe("clusterAssets", () => {
  test("groups by type and surfaces an unused cluster from counts", () => {
    const clusters: Cluster[] = clusterAssets(items as any, { a: 4, b: 1, c: 0, d: 0 })
    const byKey = Object.fromEntries(clusters.map((cluster) => [cluster.key, cluster]))
    expect(byKey.images.items.map((item) => item.id)).toContain("a")
    expect(byKey.video.items.map((item) => item.id)).toEqual(["b"])
    expect(byKey.docs.items.map((item) => item.id)).toEqual(["c"])
    expect(byKey.unused.items.map((item) => item.id).sort()).toEqual(["c", "d"])
  })
})
