import { describe, expect, test } from "bun:test"
import { runAsk } from "../../src/ask/handler"

describe("runAsk", () => {
  test("falls back to FTS when no provider is configured", async () => {
    const result = await runAsk({
      q: "hello",
      provider: undefined,
      embeddings: undefined,
      fts: () => [{ collection: "post", document_id: "1" }],
      resolve: async (collection, documentId) => ({
        title: "Hi",
        text: "Plain result",
        href: `/content/${collection}/${documentId}`,
      }),
    })

    expect(result.answer).toBeUndefined()
    expect(result.data[0]).toMatchObject({
      collection: "post",
      documentId: "1",
      title: "Hi",
      href: "/content/post/1",
    })
  })

  test("uses semantic hits and synthesized answers when a provider is configured", async () => {
    const provider = {
      model: "m",
      embed: async () => [[1, 0, 0]],
      synthesize: async () => "Because reasons.",
    }
    const embeddings = {
      search: () => [{ collection: "post", document_id: "9", score: 0.9 }],
    }

    const result = await runAsk({
      q: "why",
      provider,
      embeddings,
      fts: () => [],
      resolve: async (collection, documentId) => ({
        title: "Doc",
        text: "Doc body",
        href: `/content/${collection}/${documentId}`,
      }),
    })

    expect(result.data[0].documentId).toBe("9")
    expect(result.answer).toBe("Because reasons.")
  })
})
