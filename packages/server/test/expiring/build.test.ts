import { describe, expect, test } from "bun:test"
import { buildExpiring } from "../../src/expiring/build"

const now = new Date("2026-06-01T12:00:00.000Z")

function fakeCollections() {
  const entry = {
    def: {
      name: "post",
      labels: { plural: "Posts" },
      fields: {
        title: { type: "text" },
        status: { type: "select" },
        unpublishAt: { type: "datetime" },
      },
    },
    service: {
      async findMany() {
        return [
          { id: "soon", title: "Soon", status: "published", unpublishAt: "2026-06-03T12:00:00.000Z" },
          { id: "far", title: "Far", status: "published", unpublishAt: "2026-07-01T12:00:00.000Z" },
          { id: "past", title: "Past", status: "published", unpublishAt: "2026-05-30T12:00:00.000Z" },
        ]
      },
    },
  }
  return new Map([["post", entry as any]])
}

describe("buildExpiring", () => {
  test("returns published docs expiring within the window, sorted ascending", async () => {
    const items = await buildExpiring(fakeCollections() as any, now, 7)
    expect(items.map((i) => i.documentId)).toEqual(["soon"])
    expect(items[0]).toMatchObject({ collection: "post", title: "Soon" })
  })
})
