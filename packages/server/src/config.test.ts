import { expect, test } from "bun:test"
import { resolve } from "node:path"
import { loadConfig } from "@not-a-cms/core"
import { createServerConfigFromCMSConfig, resolveConfigLoadOptions } from "./config"

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
  expect(
    resolveConfigLoadOptions({ CONFIG_PATH: "dogfood-sites/studio/not-a-cms.config.ts" }),
  ).toEqual({ path: "dogfood-sites/studio/not-a-cms.config.ts" })
})

test("resolveConfigLoadOptions returns empty options without CONFIG_PATH", () => {
  expect(resolveConfigLoadOptions({})).toEqual({})
})

const baseConfig = { collections: [], site: { name: "T" } }

test("createServerConfigFromCMSConfig threads site identity through to ServerConfig", () => {
  const cfg = createServerConfigFromCMSConfig(
    {
      collections: [],
      site: {
        name: "Atelier",
        url: "https://atelier.studio",
        nav: {
          links: [
            { label: "Work", href: "/work" },
            { label: "About", href: "/about", external: false },
          ],
          cta: { label: "Start", href: "/contact" },
        },
        footer: {
          tagline: "Craft over noise.",
          columns: [{ heading: "Studio", links: [{ label: "Work", href: "/work" }] }],
          social: [{ label: "GitHub", href: "https://github.com/atelier" }],
          legal: "© 2026 Atelier",
        },
      },
    } as any,
    {},
  )

  expect(cfg.site?.name).toBe("Atelier")
  expect(cfg.site?.url).toBe("https://atelier.studio")
  expect(cfg.site?.nav?.links).toHaveLength(2)
  expect(cfg.site?.nav?.cta?.label).toBe("Start")
  expect(cfg.site?.footer?.legal).toBe("© 2026 Atelier")
  expect(cfg.site?.footer?.tagline).toBe("Craft over noise.")
  expect(cfg.site?.footer?.social).toHaveLength(1)
})

test("createServerConfigFromCMSConfig passes undefined site when site is absent", () => {
  const cfg = createServerConfigFromCMSConfig({ collections: [] } as any, {})
  expect(cfg.site).toBeUndefined()
})

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
