import { test, expect, describe, afterEach } from "bun:test"
import { existsSync, rmSync } from "node:fs"
import { join } from "node:path"

describe("init command", () => {
  const testDir = join(import.meta.dir, "test-project")

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true })
    }
  })

  test("scaffolds a project with expected files", async () => {
    // Import to register the command
    await import("../src/commands/init")
    const { commands } = await import("../src/router")
    const initCmd = commands.get("init")

    // Change cwd temporarily
    const originalCwd = process.cwd()
    process.chdir(join(import.meta.dir))

    try {
      await initCmd!.run(["test-project"])
    } finally {
      process.chdir(originalCwd)
    }

    expect(existsSync(join(testDir, "package.json"))).toBe(true)
    expect(existsSync(join(testDir, "not-a-cms.config.ts"))).toBe(true)
    expect(existsSync(join(testDir, "collections/blog-post.ts"))).toBe(true)
    expect(existsSync(join(testDir, "collections/page.ts"))).toBe(true)
    expect(existsSync(join(testDir, ".env"))).toBe(true)
    expect(existsSync(join(testDir, ".gitignore"))).toBe(true)
    expect(existsSync(join(testDir, "tsconfig.json"))).toBe(true)
  })
})
