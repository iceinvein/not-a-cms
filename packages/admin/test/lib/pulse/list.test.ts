import { describe, expect, test } from "bun:test"
import type { PresenceRoomView } from "../../../src/lib/desk/live"
import { presenceByDocument, scheduledAt, statusToSignal } from "../../../src/lib/pulse/list"

describe("statusToSignal", () => {
  test("maps content statuses to signal kinds", () => {
    expect(statusToSignal("draft")).toBe("draft")
    expect(statusToSignal("in_review")).toBe("in_review")
    expect(statusToSignal("published")).toBe("published")
    expect(statusToSignal("scheduled")).toBe("scheduled")
    expect(statusToSignal("archived")).toBe("dormant")
    expect(statusToSignal(undefined)).toBe("draft")
    expect(statusToSignal("weird")).toBe("draft")
  })
})

describe("scheduledAt", () => {
  test("reads publishedAt or published_at, else undefined", () => {
    expect(scheduledAt({ id: "1", publishedAt: "2026-06-20T00:00:00.000Z" })).toBe(
      "2026-06-20T00:00:00.000Z",
    )
    expect(scheduledAt({ id: "1", published_at: "2026-06-21T00:00:00.000Z" })).toBe(
      "2026-06-21T00:00:00.000Z",
    )
    expect(scheduledAt({ id: "1" })).toBeUndefined()
  })
})

describe("presenceByDocument", () => {
  const rooms: PresenceRoomView[] = [
    {
      collection: "page",
      documentId: "home",
      title: "Home",
      users: [
        { name: "Maya", color: "#6ea8fe" },
        { name: "Maya", color: "#6ea8fe" },
      ],
    },
    { collection: "page", documentId: "about", title: "About", users: [{ name: "Jo", color: "#f472b6" }] },
    { collection: "post", documentId: "x", title: "X", users: [{ name: "Al", color: "#a78bfa" }] },
  ]

  test("groups deduped people by document for the given collection only", () => {
    const map = presenceByDocument(rooms, "page")
    expect(Object.keys(map).sort()).toEqual(["about", "home"])
    expect(map.home.map((p) => p.name)).toEqual(["Maya"]) // deduped
    expect(map.about[0].color).toBe("#f472b6")
    expect(map.x).toBeUndefined() // other collection excluded
  })
})
