import { describe, expect, test } from "bun:test"
import { createScheduler } from "../../src/content/scheduler"

const now = new Date("2026-06-01T12:00:00.000Z")

function fakeCollections(docs: any[], fields: Record<string, any>) {
  const transitions: any[] = []
  const entry = {
    def: { name: "post", fields },
    table: {},
    service: {
      async findMany() {
        return docs
      },
      async transitionStatus(id: string, action: string, role: string) {
        transitions.push({ id, action, role })
        return { id, status: "archived" }
      },
    },
  }
  return { collections: new Map([["post", entry as any]]), transitions }
}

describe("unpublishExpired", () => {
  test("archives published docs whose unpublishAt is past", async () => {
    const { collections, transitions } = fakeCollections(
      [
        { id: "a", status: "published", unpublishAt: "2026-06-01T10:00:00.000Z" },
        { id: "b", status: "published", unpublishAt: "2026-12-01T10:00:00.000Z" },
        { id: "c", status: "published" },
      ],
      { status: { type: "select" }, unpublishAt: { type: "datetime" } },
    )
    const archived = await createScheduler(collections).unpublishExpired(now)
    expect(transitions).toEqual([{ id: "a", action: "archive", role: "admin" }])
    expect(archived).toHaveLength(1)
  })

  test("skips collections without an unpublish field", async () => {
    const { collections, transitions } = fakeCollections(
      [{ id: "a", status: "published", unpublishAt: "2026-06-01T10:00:00.000Z" }],
      { status: { type: "select" } },
    )
    await createScheduler(collections).unpublishExpired(now)
    expect(transitions).toEqual([])
  })
})
