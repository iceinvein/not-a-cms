import { test, expect, describe, afterAll } from "bun:test"
import { mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { createImageOptimizer } from "../../src/media/optimizer"

const testDir = "test-optimized-uploads"

describe("createImageOptimizer", () => {
  afterAll(() => {
    try { rmSync(testDir, { recursive: true }) } catch {}
  })

  test("processImage() generates WebP variant", async () => {
    mkdirSync(testDir, { recursive: true })
    const optimizer = createImageOptimizer(testDir)

    const { default: sharp } = await import("sharp")
    const inputBuffer = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
    }).png().toBuffer()

    const inputPath = join(testDir, "test-input.png")
    await Bun.write(inputPath, inputBuffer)

    const result = await optimizer.processImage(inputPath, "test-id")

    expect(result.width).toBe(100)
    expect(result.height).toBe(100)
    expect(result.variants.length).toBeGreaterThanOrEqual(1)
    expect(result.variants.some((v) => v.format === "webp")).toBe(true)
  })

  test("processImage() extracts dimensions", async () => {
    const optimizer = createImageOptimizer(testDir)

    const { default: sharp } = await import("sharp")
    const inputBuffer = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 0, g: 0, b: 255 } },
    }).png().toBuffer()

    const inputPath = join(testDir, "test-dimensions.png")
    await Bun.write(inputPath, inputBuffer)

    const result = await optimizer.processImage(inputPath, "dim-test")
    expect(result.width).toBe(800)
    expect(result.height).toBe(600)
  })

  test("processImage() generates blur placeholder", async () => {
    const optimizer = createImageOptimizer(testDir)

    const { default: sharp } = await import("sharp")
    const inputBuffer = await sharp({
      create: { width: 200, height: 200, channels: 3, background: { r: 0, g: 255, b: 0 } },
    }).png().toBuffer()

    const inputPath = join(testDir, "test-blur.png")
    await Bun.write(inputPath, inputBuffer)

    const result = await optimizer.processImage(inputPath, "blur-test")
    expect(result.blurDataURL).toBeDefined()
    expect(result.blurDataURL).toMatch(/^data:image\//)
  })

  test("processImage() generates responsive variants for large images", async () => {
    const optimizer = createImageOptimizer(testDir)

    const { default: sharp } = await import("sharp")
    const inputBuffer = await sharp({
      create: { width: 2000, height: 1500, channels: 3, background: { r: 128, g: 128, b: 128 } },
    }).png().toBuffer()

    const inputPath = join(testDir, "test-large.png")
    await Bun.write(inputPath, inputBuffer)

    const result = await optimizer.processImage(inputPath, "large-test")
    const widths = result.variants.map((v) => v.width)
    expect(widths.some((w) => w <= 640)).toBe(true)
    expect(widths.some((w) => w <= 1024)).toBe(true)
  })
})
