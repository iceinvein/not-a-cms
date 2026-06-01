import { describe, expect, test } from "bun:test"
import { askContent } from "../../../src/lib/command/ask-search"

describe("askContent", () => {
  test("empty query returns no hits and makes no request", async () => {
    let calls = 0
    const res = await askContent("", "", async () => {
      calls++
      return { data: [] }
    })

    expect(res).toEqual({ hits: [] })
    expect(calls).toBe(0)
  })

  test("maps /api/_ask response to hits and answer", async () => {
    const res = await askContent("", "why", async () => ({
      data: [{ collection: "post", documentId: "1", title: "Hi", href: "/content/post/1" }],
      answer: "An answer.",
    }))

    expect(res.answer).toBe("An answer.")
    expect(res.hits[0]).toMatchObject({
      collection: "post",
      collectionLabel: "post",
      documentId: "1",
      title: "Hi",
      href: "/content/post/1",
    })
  })
})
