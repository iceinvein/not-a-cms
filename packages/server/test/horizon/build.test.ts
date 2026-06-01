import { describe, expect, test } from "bun:test"
import { buildHorizon } from "../../src/horizon/build"

const now = new Date("2026-06-01T12:00:00.000Z")

function fakeCollections() {
  const entry = {
    def: {
      name: "post",
      labels: { singular: "Post", plural: "Posts" },
      fields: {
        title: { type: "text" },
        status: { type: "select" },
        publishedAt: { type: "datetime" },
      },
    },
    service: {
      async findMany() {
        return [
          { id: "a", title: "Alpha", status: "scheduled", publishedAt: "2026-06-04T09:00:00.000Z" },
          { id: "b", status: "scheduled", publishedAt: "2026-06-01T11:00:00.000Z" },
        ]
      },
    },
  }
  return new Map([["post", entry as any]])
}

describe("buildHorizon", () => {
  test("aggregates scheduled docs across collections and buckets them", async () => {
    const h = await buildHorizon(fakeCollections() as any, now)
    expect(h.now.map((i) => i.documentId)).toEqual(["b"])
    expect(h.week.map((i) => i.title)).toEqual(["Alpha"])
    expect(h.now[0].title).toBe("b")
  })
})
