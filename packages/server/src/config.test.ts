import { test, expect } from "bun:test"
import { resolve } from "node:path"
import { loadConfig } from "@not-a-cms/core"

test("not-a-cms project config loads and declares its collections", async () => {
  const path = resolve(import.meta.dir, "../../../dogfood-sites/not-a-cms/not-a-cms.config.ts")
  const config = await loadConfig({ path })
  const names = config.collections.map((c) => c.name).sort()
  expect(names).toEqual(["author", "blog_post", "page"])
  expect(config.database?.url).toBe("dogfood.db")
})

test("studio project config loads with the project collection", async () => {
  const path = resolve(import.meta.dir, "../../../dogfood-sites/studio/not-a-cms.config.ts")
  const config = await loadConfig({ path })
  const names = config.collections.map((c) => c.name).sort()
  expect(names).toEqual(["blog_post", "page", "project"])
  expect(config.database?.url).toBe("studio.db")
})
