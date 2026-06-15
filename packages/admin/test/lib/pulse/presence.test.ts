import { describe, expect, test } from "bun:test"
import type { PresenceRoomView } from "../../../src/lib/desk/live"
import { presenceToPeople } from "../../../src/lib/pulse/presence"

const rooms: PresenceRoomView[] = [
  {
    collection: "page",
    documentId: "home",
    title: "Home",
    users: [
      { name: "Maya", color: "#6ea8fe" },
      { name: "James", color: "#f472b6" },
    ],
  },
  {
    collection: "page",
    documentId: "about",
    title: "About",
    users: [{ name: "Maya", color: "#6ea8fe" }],
  },
]

describe("presenceToPeople", () => {
  test("flattens, dedupes by name, sorts, and keeps color", () => {
    const people = presenceToPeople(rooms)
    expect(people.map((p) => p.name)).toEqual(["James", "Maya"])
    expect(people.find((p) => p.name === "Maya")?.color).toBe("#6ea8fe")
    expect(people.every((p) => p.id === p.name)).toBe(true)
  })

  test("empty rooms yield no people", () => {
    expect(presenceToPeople([])).toEqual([])
  })
})
