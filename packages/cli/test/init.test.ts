import { test, expect, describe, afterEach } from "bun:test"
import { existsSync, readFileSync, rmSync } from "node:fs"
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
    expect(existsSync(join(testDir, "theme/index.ts"))).toBe(true)
    expect(existsSync(join(testDir, "extensions/example.ts"))).toBe(true)
    expect(existsSync(join(testDir, ".env"))).toBe(true)
    expect(existsSync(join(testDir, ".gitignore"))).toBe(true)
    expect(existsSync(join(testDir, "tsconfig.json"))).toBe(true)

    const tsconfig = JSON.parse(readFileSync(join(testDir, "tsconfig.json"), "utf8"))
    expect(tsconfig.compilerOptions.types).toEqual(["bun"])

    const pkg = JSON.parse(readFileSync(join(testDir, "package.json"), "utf8"))
    expect(pkg.scripts.dev).toBe("not-a-cms dev")
    expect(pkg.scripts.preview).toBeUndefined()

    const config = readFileSync(join(testDir, "not-a-cms.config.ts"), "utf8")
    expect(config).toContain('import { starterTheme } from "./theme"')
    expect(config).toContain('import { exampleExtension } from "./extensions/example"')
    expect(config).toContain("process.env.SITE_URL")
    expect(config).toContain("process.env.DATABASE_URL")
    expect(config).toContain("process.env.MEDIA_STORAGE_PATH")
    expect(config).toContain('methods: ["magic-link", "oauth"]')
    expect(config).toContain("theme: starterTheme")
    expect(config).toContain("extensions: [exampleExtension]")
    expect(config).toContain("channels:")
    expect(config).toContain('itemPath: "/blog/:slug"')

    const env = readFileSync(join(testDir, ".env"), "utf8")
    expect(env).toContain("BASE_URL=http://localhost:4321")
    expect(env).toContain("CORS_ORIGINS=http://localhost:4322,http://localhost:3000")
    expect(env).toContain("MEDIA_STORAGE_PATH=./uploads")
    expect(env).toContain("# Optional S3/R2 media storage")

    const theme = readFileSync(join(testDir, "theme/index.ts"), "utf8")
    expect(theme).toContain("defineTheme")
    expect(theme).toContain("components")

    const extension = readFileSync(join(testDir, "extensions/example.ts"), "utf8")
    expect(extension).toContain("defineExtension")
    expect(extension).toContain("exampleExtension")
  })
})
