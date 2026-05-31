import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { bootstrapTables, createContentService, createDatabase, generateTable } from "@not-a-cms/core"
import { exportContentToJSON } from "../src/commands/export"

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe("export command helpers", () => {
  test("exports configured collections as JSON", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "not-a-cms-export-"))
    tempDirs.push(cwd)
    const dbPath = join(cwd, "site.db")
    const outputPath = join(cwd, "content-export.json")
    const config = await writeProjectConfig(cwd, dbPath)

    const db = createDatabase({ url: dbPath })
    bootstrapTables(db, config.collections)
    const table = generateTable(config.collections[0])
    const service = createContentService(db, config.collections[0], table)
    await service.create({ title: "Export Me", slug: "export-me", status: "published" })

    const result = await exportContentToJSON({ cwd, outputPath })

    expect(result.counts).toEqual({ blog_post: 1 })
    expect(existsSync(outputPath)).toBe(true)
    const exported = JSON.parse(readFileSync(outputPath, "utf8"))
    expect(exported.collections.blog_post[0]).toMatchObject({
      title: "Export Me",
      slug: "export-me",
      status: "published",
    })
  })
})

async function writeProjectConfig(cwd: string, dbPath: string) {
  const configPath = join(cwd, "not-a-cms.config.ts")
  writeFileSync(
    configPath,
    `import { defineCollection, defineConfig, field } from "${import.meta.dir}/../../core/src/index.ts"

const blogPost = defineCollection({
  name: "blog_post",
  fields: {
    title: field.text(),
    slug: field.slug({ from: "title" }),
    status: field.select(["draft", "published"], { default: "draft" }),
  },
})

export default defineConfig({
  database: { provider: "sqlite", url: "${dbPath}" },
  collections: [blogPost],
})
`,
  )
  const mod = await import(`${configPath}?v=${Date.now()}`)
  return mod.default
}
