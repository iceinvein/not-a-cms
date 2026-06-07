import { test, expect } from "bun:test"
import { resolve } from "node:path"
import { loadConfig } from "@not-a-cms/core"
import { resolveConfigLoadOptions, createServerConfigFromCMSConfig } from "./config"

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

test("resolveConfigLoadOptions prefers CONFIG_PATH when set", () => {
  expect(resolveConfigLoadOptions({ CONFIG_PATH: "dogfood-sites/studio/not-a-cms.config.ts" }))
    .toEqual({ path: "dogfood-sites/studio/not-a-cms.config.ts" })
})

test("resolveConfigLoadOptions returns empty options without CONFIG_PATH", () => {
  expect(resolveConfigLoadOptions({})).toEqual({})
})

const baseConfig = { collections: [], site: { name: "T" } }

test("E2E_TEST_AUTH enables a captured magic-link seam on the real config path", async () => {
  const cfg = createServerConfigFromCMSConfig(baseConfig as any, { E2E_TEST_AUTH: "1" })
  expect(cfg.testAuth?.enabled).toBe(true)
  await cfg.auth.magicLink!.sendMagicLink({ email: "a@b.dev", url: "http://link", token: "tok" })
  expect(cfg.testAuth?.getMagicLink("a@b.dev")).toBe("http://link")
})

test("without E2E_TEST_AUTH there is no testAuth block", () => {
  const cfg = createServerConfigFromCMSConfig(baseConfig as any, {})
  expect(cfg.testAuth).toBeUndefined()
})
