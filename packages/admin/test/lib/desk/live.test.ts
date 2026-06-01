import { describe, expect, test } from "bun:test"
import { toLiveRows } from "../../../src/lib/desk/live"

describe("toLiveRows", () => {
  test("flattens rooms into per-user rows with links, sorted by name", () => {
    const rooms = [
      { collection: "post", documentId: "1", title: "Launch week", users: [{ name: "Sam", color: "#1" }] },
      { collection: "page", documentId: "9", title: "Pricing", users: [{ name: "Jo", color: "#2" }] },
    ]
    const rows = toLiveRows(rooms as any)
    expect(rows.map((r) => r.name)).toEqual(["Jo", "Sam"])
    expect(rows[0]).toMatchObject({ name: "Jo", title: "Pricing", href: "/content/page/9" })
  })
})
