import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { loadConfig, ConfigLoadError } from "../src/config"

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe("project config loading", () => {
  test("loads not-a-cms.config.ts from the provided cwd", async () => {
    const cwd = makeTempProject()
    writeFileSync(
      join(cwd, "not-a-cms.config.ts"),
      `import { defineCollection, defineConfig, field } from "${import.meta.dir}/../src/index.ts"

const page = defineCollection({
  name: "page",
  fields: {
    title: field.text({ required: true }),
  },
})

export default defineConfig({
  site: { name: "Loaded Site" },
  database: { provider: "sqlite", url: "loaded.db" },
  collections: [page],
})
`,
    )

    const config = await loadConfig({ cwd })

    expect(config.site?.name).toBe("Loaded Site")
    expect(config.database?.url).toBe("loaded.db")
    expect(config.collections.map((collection) => collection.name)).toEqual(["page"])
  })

  test("throws a config error for missing config files", async () => {
    const cwd = makeTempProject()

    await expect(loadConfig({ cwd })).rejects.toThrow(ConfigLoadError)
    await expect(loadConfig({ cwd })).rejects.toThrow("No not-a-cms.config.ts found")
  })

  test("throws a config error for invalid config defaults", async () => {
    const cwd = makeTempProject()
    writeFileSync(join(cwd, "not-a-cms.config.ts"), "export default { database: { url: 'bad.db' } }")

    await expect(loadConfig({ cwd })).rejects.toThrow(ConfigLoadError)
    await expect(loadConfig({ cwd })).rejects.toThrow("collections must be an array")
  })
})

function makeTempProject() {
  const dir = mkdtempSync(join(tmpdir(), "not-a-cms-config-"))
  tempDirs.push(dir)
  return dir
}
