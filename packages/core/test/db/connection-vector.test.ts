import { describe, expect, test } from "bun:test"
import { createDatabase, isVectorSearchEnabled } from "../../src/db/connection"

// Probe via the real code path FIRST so setCustomSQLite (process-global) is
// established before any other Database in this file. OK reflects whether this
// machine/process can load the extension.
const probe = createDatabase({ url: ":memory:", vectorSearch: { enabled: true } })
const OK = isVectorSearchEnabled(probe)

describe("createDatabase vector search capability", () => {
  test("capability is false when vectorSearch is not requested", () => {
    const db = createDatabase({ url: ":memory:" })
    expect(isVectorSearchEnabled(db)).toBe(false)
  })

  test.skipIf(!OK)("capability is true and a vec function runs when enabled", () => {
    const db = createDatabase({ url: ":memory:", vectorSearch: { enabled: true } })
    expect(isVectorSearchEnabled(db)).toBe(true)
    const row = db.get<{ v: string }>(
      // raw vec function via drizzle sql; proves the extension is live on this handle
      require("drizzle-orm").sql`select vec_version() as v`,
    )
    expect(typeof row?.v).toBe("string")
  })
})
