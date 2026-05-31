import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createMigrationFilename, formatMigrationStatus } from "../src/commands/generate"

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe("generate command helpers", () => {
  test("creates deterministic migration filenames", () => {
    const filename = createMigrationFilename("add posts", new Date("2026-05-31T12:34:56.000Z"))

    expect(filename).toBe("20260531123456_add_posts.sql")
  })

  test("formats migration status with applied and pending files", () => {
    const output = formatMigrationStatus("site.db", {
      applied: ["001_init.sql"],
      pending: ["002_add_posts.sql"],
    })

    expect(output).toContain("Database: site.db")
    expect(output).toContain("Applied: 1")
    expect(output).toContain("[applied] 001_init.sql")
    expect(output).toContain("Pending: 1")
    expect(output).toContain("[pending] 002_add_posts.sql")
  })

  test("generateMigrationFile writes useful SQL into migrations directory", async () => {
    const cwd = makeTempProject()
    const configPath = join(cwd, "not-a-cms.config.ts")
    writeFileSync(
      configPath,
      `import { defineCollection, defineConfig, field } from "${import.meta.dir}/../../core/src/index.ts"

const post = defineCollection({
  name: "post",
  fields: {
    title: field.text({ required: true }),
  },
})

export default defineConfig({
  database: { provider: "sqlite", url: "${join(cwd, "site.db")}" },
  collections: [post],
})
`,
    )

    const { generateMigrationFile } = await import("../src/commands/generate")
    const result = await generateMigrationFile({
      cwd,
      name: "init",
      now: new Date("2026-05-31T12:34:56.000Z"),
    })

    expect(result.filename).toBe("20260531123456_init.sql")
    expect(existsSync(result.filepath)).toBe(true)
    expect(readFileSync(result.filepath, "utf8")).toContain("CREATE TABLE IF NOT EXISTS post")
  })
})

function makeTempProject() {
  const dir = mkdtempSync(join(tmpdir(), "not-a-cms-generate-"))
  tempDirs.push(dir)
  return dir
}
