import { describe, expect, test } from "bun:test"
import { type NeedsYouItem, toNeedsYouItems } from "../../../src/lib/desk/needs-you"

describe("toNeedsYouItems", () => {
  test("maps review counts and failed runs into a unified, prioritized list", () => {
    const metrics = {
      collections: [
        { name: "post", label: "Posts", inReview: 2 },
        { name: "page", label: "Pages", inReview: 0 },
      ],
    }
    const failed = [
      {
        id: "r9",
        flow_id: "f1",
        status: "failed",
        error: "timeout",
        started_at: "2026-06-01T10:00:00Z",
      },
    ]
    const items: NeedsYouItem[] = toNeedsYouItems(metrics as any, failed as any)

    expect(items[0].kind).toBe("failed_run")
    expect(items.some((i) => i.kind === "review" && i.href.includes("status"))).toBe(true)
    expect(items.find((i) => i.label?.includes("Pages"))).toBeUndefined()
  })

  test("adds expiring content after failed runs and before review queues", () => {
    const metrics = {
      collections: [{ name: "post", label: "Posts", inReview: 1 }],
    }
    const failed = [
      {
        id: "r9",
        flow_id: "f1",
        status: "failed",
        error: "timeout",
        started_at: "2026-06-01T10:00:00Z",
      },
    ]
    const expiring = [
      {
        collection: "post",
        documentId: "p1",
        title: "Launch post",
        unpublishAt: "2026-06-03T12:00:00.000Z",
      },
    ]

    const items = toNeedsYouItems(
      metrics as any,
      failed as any,
      expiring,
      new Date("2026-06-01T12:00:00.000Z"),
    )

    expect(items.map((i) => i.kind)).toEqual(["failed_run", "expiring", "review"])
    expect(items[1]).toMatchObject({
      kind: "expiring",
      title: "Launch post expires in 2 days",
      href: "/content/post/p1",
      action: "extend",
      severity: "info",
    })
  })
})
