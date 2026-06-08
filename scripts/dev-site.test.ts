import { expect, test } from "bun:test"
import { resolveSiteConfigPath } from "./dev-site"

test("--site=studio maps to the studio config path", () => {
  expect(resolveSiteConfigPath(["--site=studio"], {})).toBe(
    "dogfood-sites/studio/not-a-cms.config.ts",
  )
})

test("SITE env is used when no --site arg is present", () => {
  expect(resolveSiteConfigPath([], { SITE: "not-a-cms" })).toBe(
    "dogfood-sites/not-a-cms/not-a-cms.config.ts",
  )
})

test("an explicit --site arg wins over SITE env", () => {
  expect(resolveSiteConfigPath(["--site=studio"], { SITE: "not-a-cms" })).toBe(
    "dogfood-sites/studio/not-a-cms.config.ts",
  )
})

test("falls back to an existing CONFIG_PATH when no site is named", () => {
  expect(resolveSiteConfigPath([], { CONFIG_PATH: "x/not-a-cms.config.ts" })).toBe(
    "x/not-a-cms.config.ts",
  )
})

test("returns undefined when nothing selects a site", () => {
  expect(resolveSiteConfigPath([], {})).toBeUndefined()
})
