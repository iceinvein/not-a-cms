import { describe, expect, test } from "bun:test"
import { toNeedsYouItems, type NeedsYouItem } from "../../../src/lib/desk/needs-you"

describe("toNeedsYouItems", () => {
  test("maps review counts and failed runs into a unified, prioritized list", () => {
    const metrics = {
      collections: [
        { name: "post", label: "Posts", inReview: 2 },
        { name: "page", label: "Pages", inReview: 0 },
      ],
    }
    const failed = [{ id: "r9", flow_id: "f1", status: "failed", error: "timeout", started_at: "2026-06-01T10:00:00Z" }]
    const items: NeedsYouItem[] = toNeedsYouItems(metrics as any, failed as any)

    expect(items[0].kind).toBe("failed_run")
    expect(items.some((i) => i.kind === "review" && i.href.includes("status"))).toBe(true)
    expect(items.find((i) => i.label?.includes("Pages"))).toBeUndefined()
  })
})
