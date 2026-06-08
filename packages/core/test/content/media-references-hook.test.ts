import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import { sql } from "drizzle-orm"
import { createContentService } from "../../src/content/service"
import { createDatabase } from "../../src/db/connection"
import { generateTable } from "../../src/db/generate-table"
import { defineCollection } from "../../src/schema/collection"
import { field } from "../../src/schema/field"

const testDbPath = "test-media-ref-hook.db"

const post = defineCollection({
  name: "post",
  fields: { title: field.text({ required: true }), cover: field.media({ accept: ["image/*"] }) },
})

let db: ReturnType<typeof createDatabase>

describe("content service media reference hook", () => {
  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    db.run(
      sql`CREATE TABLE IF NOT EXISTS post (id TEXT PRIMARY KEY, title TEXT NOT NULL, cover_id TEXT, created_at TEXT, updated_at TEXT)`,
    )
  })
  afterEach(() => {
    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        unlinkSync(testDbPath + suffix)
      } catch {}
    }
  })

  test("fires replaceForDocument on create/update and removeDocument on delete", async () => {
    const calls: string[] = []
    const adapter = {
      replaceForDocument: (
        c: string,
        d: string,
        refs: { assetId: string; field: string; label: string }[],
      ) => calls.push(`replace:${c}:${d}:${refs.map((r) => r.assetId).join(",")}`),
      removeDocument: (c: string, d: string) => calls.push(`remove:${c}:${d}`),
    }
    const service = createContentService(
      db,
      post,
      generateTable(post),
      undefined,
      undefined,
      undefined,
      undefined,
      adapter,
    )

    const created = await service.create({ title: "A", cover: "img1" })
    await service.update(created.id, { cover: "img2" })
    await service.remove(created.id)

    expect(calls).toEqual([
      `replace:post:${created.id}:img1`,
      `replace:post:${created.id}:img2`,
      `remove:post:${created.id}`,
    ])
  })

  test("an adapter throwing does not break the write", async () => {
    const adapter = {
      replaceForDocument: () => {
        throw new Error("boom")
      },
      removeDocument: () => {},
    }
    const service = createContentService(
      db,
      post,
      generateTable(post),
      undefined,
      undefined,
      undefined,
      undefined,
      adapter,
    )
    const created = await service.create({ title: "A", cover: "img1" })
    expect(created.id).toBeDefined()
  })
})
