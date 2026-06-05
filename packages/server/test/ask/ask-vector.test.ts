import { describe, expect, test } from "bun:test"
import { existsSync, rmSync } from "node:fs"
import {
  createDatabase,
  isVectorSearchEnabled,
  bootstrapTables,
  createEmbeddingStore,
  defineCollection,
  field,
} from "@not-a-cms/core"
import { createServer } from "../../src/index"
import { runAsk } from "../../src/ask/handler"

// Probe via the real code path first so setCustomSQLite is established here.
const probe = createDatabase({ url: ":memory:", vectorSearch: { enabled: true } })
const OK = isVectorSearchEnabled(probe)

const post = defineCollection({ name: "post", fields: { title: field.text({ required: true }) } })

describe("server vector search wiring", () => {
  test.skipIf(!OK)("createServer enables vector search on its database", () => {
    const uploads = "test-ask-vector-uploads"
    const server = createServer({
      port: 0,
      database: { url: ":memory:" },
      auth: {
        secret: "a".repeat(32),
        baseURL: "http://localhost",
        magicLink: { sendMagicLink: async () => {} },
      },
      collections: [post],
      storage: { provider: "local", path: uploads },
    })
    try {
      expect(isVectorSearchEnabled(server.db)).toBe(true)
    } finally {
      server.server.stop()
      if (existsSync(uploads)) rmSync(uploads, { recursive: true, force: true })
    }
  })

  test.skipIf(!OK)("runAsk returns vec0-ranked hits through the drizzle store path", async () => {
    const db = createDatabase({ url: ":memory:", vectorSearch: { enabled: true } })
    bootstrapTables(db, [])
    const embeddings = createEmbeddingStore(db, { vectorSearch: isVectorSearchEnabled(db) })
    embeddings.upsert("post", "a", new Float32Array([1, 0, 0]), "m")
    embeddings.upsert("post", "b", new Float32Array([0, 1, 0]), "m")
    const result = await runAsk({
      q: "anything",
      provider: { model: "m", embed: async () => [[1, 0, 0]] },
      embeddings,
      fts: () => [],
      resolve: async (c, d) => ({ title: d, text: "", href: `/content/${c}/${d}` }),
    })
    expect(result.data[0]?.documentId).toBe("a")
  })
})
