import { describe, expect, test } from "bun:test"
import { buildPresenceRooms } from "../../src/collab/rooms"

const snapshot = [
  { docName: "content:post:1:title", users: [{ clientId: "a", name: "Sam", color: "#1" }] },
  {
    docName: "content:post:1:body",
    users: [
      { clientId: "b", name: "Sam", color: "#1" },
      { clientId: "c", name: "Jo", color: "#2" },
    ],
  },
  { docName: "not-content", users: [{ clientId: "d", name: "X", color: "#3" }] },
]

describe("buildPresenceRooms", () => {
  test("groups by document, dedupes by name, enriches title, skips non-content", async () => {
    const resolveTitle = async (collection: string, id: string) => `Title of ${collection}/${id}`
    const rooms = await buildPresenceRooms(snapshot as any, resolveTitle)
    expect(rooms).toHaveLength(1)
    expect(rooms[0]).toMatchObject({
      collection: "post",
      documentId: "1",
      title: "Title of post/1",
    })
    expect(rooms[0].users.map((u) => u.name).sort()).toEqual(["Jo", "Sam"])
  })
})
