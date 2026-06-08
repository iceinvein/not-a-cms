import { describe, expect, test } from "bun:test"
import { bucketHorizon, type HorizonItem } from "../../src/content/horizon"

const now = new Date("2026-06-01T12:00:00.000Z")
const items: HorizonItem[] = [
  {
    collection: "post",
    documentId: "due",
    title: "Due now",
    publishedAt: "2026-06-01T11:00:00.000Z",
    status: "scheduled",
  },
  {
    collection: "post",
    documentId: "today",
    title: "Later today",
    publishedAt: "2026-06-01T20:00:00.000Z",
    status: "scheduled",
  },
  {
    collection: "post",
    documentId: "week",
    title: "Thursday",
    publishedAt: "2026-06-04T09:00:00.000Z",
    status: "scheduled",
  },
  {
    collection: "post",
    documentId: "later",
    title: "Year end",
    publishedAt: "2026-12-20T09:00:00.000Z",
    status: "scheduled",
  },
]

describe("bucketHorizon", () => {
  test("sorts items into now / today / week / later by publishedAt", () => {
    const b = bucketHorizon(items, now)
    expect(b.now.map((i) => i.documentId)).toEqual(["due"])
    expect(b.today.map((i) => i.documentId)).toEqual(["today"])
    expect(b.week.map((i) => i.documentId)).toEqual(["week"])
    expect(b.later.map((i) => i.documentId)).toEqual(["later"])
  })

  test("each bucket is sorted ascending by publishedAt", () => {
    const two: HorizonItem[] = [
      {
        collection: "p",
        documentId: "b",
        title: "B",
        publishedAt: "2026-06-04T10:00:00.000Z",
        status: "scheduled",
      },
      {
        collection: "p",
        documentId: "a",
        title: "A",
        publishedAt: "2026-06-03T10:00:00.000Z",
        status: "scheduled",
      },
    ]
    expect(bucketHorizon(two, now).week.map((i) => i.documentId)).toEqual(["a", "b"])
  })

  test("items without a publishedAt are dropped", () => {
    const b = bucketHorizon(
      [{ collection: "p", documentId: "x", title: "x", publishedAt: null, status: "draft" }],
      now,
    )
    expect(b.now.length + b.today.length + b.week.length + b.later.length).toBe(0)
  })
})
