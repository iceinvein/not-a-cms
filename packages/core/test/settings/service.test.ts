import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import { bootstrapTables } from "../../src/db/bootstrap"
import { createDatabase } from "../../src/db/connection"
import { createSettingsService } from "../../src/settings/service"

const testDbPath = "test-settings.db"
let db: ReturnType<typeof createDatabase>
let settings: ReturnType<typeof createSettingsService>

describe("createSettingsService", () => {
  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [])
    settings = createSettingsService(db)
  })

  afterEach(() => {
    try {
      unlinkSync(testDbPath)
    } catch {}
    try {
      unlinkSync(testDbPath + "-wal")
    } catch {}
    try {
      unlinkSync(testDbPath + "-shm")
    } catch {}
  })

  test("get() returns null for non-existent key", () => {
    expect(settings.get("missing")).toBeNull()
  })

  test("set() and get() round-trip a value", () => {
    settings.set("theme.color", "#ff0000")
    expect(settings.get("theme.color")).toBe("#ff0000")
  })

  test("set() overwrites existing value", () => {
    settings.set("theme.color", "#ff0000")
    settings.set("theme.color", "#00ff00")
    expect(settings.get("theme.color")).toBe("#00ff00")
  })

  test("getAll() returns all settings", () => {
    settings.set("theme.color", "red")
    settings.set("theme.font", "sans-serif")
    settings.set("other.key", "value")
    const all = settings.getAll()
    expect(Object.keys(all)).toHaveLength(3)
  })

  test("getAll() filters by prefix", () => {
    settings.set("theme.color", "red")
    settings.set("theme.font", "sans-serif")
    settings.set("other.key", "value")
    const themed = settings.getAll("theme.")
    expect(Object.keys(themed)).toHaveLength(2)
    expect(themed["theme.color"]).toBe("red")
  })

  test("remove() deletes a setting", () => {
    settings.set("theme.color", "red")
    settings.remove("theme.color")
    expect(settings.get("theme.color")).toBeNull()
  })

  test("collection settings round-trip structured values", () => {
    const saved = settings.setCollectionSettings("blog_post", {
      labels: { singular: "Article", plural: "Articles" },
      access: { read: ["viewer"], create: ["editor"], update: ["editor"], delete: ["admin"] },
      previewPath: "/blog/:slug",
      searchFields: ["title", "excerpt"],
      editorLayout: "sidebar",
    })

    expect(saved).toEqual({
      labels: { singular: "Article", plural: "Articles" },
      access: { read: ["viewer"], create: ["editor"], update: ["editor"], delete: ["admin"] },
      previewPath: "/blog/:slug",
      searchFields: ["title", "excerpt"],
      editorLayout: "sidebar",
    })
    expect(settings.getCollectionSettings("blog_post")).toEqual(saved)
  })

  test("collection settings ignore unknown keys and normalize arrays", () => {
    const saved = settings.setCollectionSettings("page", {
      labels: { singular: "Page" },
      access: { read: ["viewer", "viewer"], update: "editor" as unknown as string[] },
      previewPath: "pages/:slug",
      searchFields: ["title", "title", ""],
      editorLayout: "",
      extra: true,
    } as any)

    expect(saved).toEqual({
      labels: { singular: "Page" },
      access: { read: ["viewer"], update: [] },
      previewPath: "/pages/:slug",
      searchFields: ["title"],
    })
  })
})
