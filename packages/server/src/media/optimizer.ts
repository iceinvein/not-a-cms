import { existsSync, mkdirSync, statSync } from "node:fs"
import { join } from "node:path"
import sharp from "sharp"

const RESPONSIVE_WIDTHS = [640, 768, 1024, 1280, 1536]
const OUTPUT_FORMATS = ["webp", "avif"] as const

type ImageVariant = {
  width: number
  height: number
  format: string
  path: string
  size: number
}

type ProcessResult = {
  width: number
  height: number
  blurDataURL: string
  variants: ImageVariant[]
}

type VariantFormat = (typeof OUTPUT_FORMATS)[number]

export function createImageOptimizer(outputDir: string) {
  mkdirSync(outputDir, { recursive: true })

  async function processImage(inputPath: string, id: string): Promise<ProcessResult> {
    const metadata = await sharp(inputPath).metadata()
    const origWidth = metadata.width ?? 0
    const origHeight = metadata.height ?? 0

    // Generate blur placeholder (tiny base64)
    const blurBuffer = await sharp(inputPath)
      .resize(20, 20, { fit: "inside" })
      .blur(10)
      .jpeg({ quality: 40 })
      .toBuffer()
    const blurDataURL = `data:image/jpeg;base64,${blurBuffer.toString("base64")}`

    const variants: ImageVariant[] = []
    const variantDir = join(outputDir, id)
    mkdirSync(variantDir, { recursive: true })

    // Generate responsive + format variants
    const targetWidths = RESPONSIVE_WIDTHS.filter((w) => w < origWidth)
    targetWidths.push(origWidth)

    for (const width of targetWidths) {
      for (const format of OUTPUT_FORMATS) {
        const filename = `${width}.${format}`
        const outputPath = join(variantDir, filename)
        const height = Math.round((width / origWidth) * origHeight)

        try {
          const pipeline = sharp(inputPath).resize(width, height, {
            fit: "inside",
            withoutEnlargement: true,
          })

          let result: Awaited<ReturnType<typeof pipeline.toFile>>
          if (format === "webp") {
            result = await pipeline.webp({ quality: 80 }).toFile(outputPath)
          } else {
            result = await pipeline.avif({ quality: 65 }).toFile(outputPath)
          }

          variants.push({
            width: result.width,
            height: result.height,
            format,
            path: outputPath,
            size: result.size,
          })
        } catch {
          // Skip variants that fail (e.g., AVIF for very small images)
        }
      }
    }

    return { width: origWidth, height: origHeight, blurDataURL, variants }
  }

  async function getOrCreateVariant(
    inputPath: string,
    id: string,
    options: { width: number; format: VariantFormat },
  ): Promise<ImageVariant> {
    const variantDir = join(outputDir, id)
    mkdirSync(variantDir, { recursive: true })
    const outputPath = join(variantDir, `${options.width}.${options.format}`)
    if (existsSync(outputPath)) {
      const metadata = await sharp(outputPath).metadata()
      return {
        width: metadata.width ?? options.width,
        height: metadata.height ?? 0,
        format: options.format,
        path: outputPath,
        size: statSync(outputPath).size,
      }
    }

    const metadata = await sharp(inputPath).metadata()
    const origWidth = metadata.width ?? 0
    const origHeight = metadata.height ?? 0
    if (origWidth <= 0 || origHeight <= 0)
      throw new Error("Cannot create image variant without dimensions")
    const width = Math.min(options.width, origWidth)
    const height = Math.round((width / origWidth) * origHeight)
    const pipeline = sharp(inputPath).resize(width, height, {
      fit: "inside",
      withoutEnlargement: true,
    })
    const result =
      options.format === "webp"
        ? await pipeline.webp({ quality: 80 }).toFile(outputPath)
        : await pipeline.avif({ quality: 65 }).toFile(outputPath)

    return {
      width: result.width,
      height: result.height,
      format: options.format,
      path: outputPath,
      size: result.size,
    }
  }

  return { processImage, getOrCreateVariant }
}

export type ImageOptimizer = ReturnType<typeof createImageOptimizer>
export type { ImageVariant, ProcessResult, VariantFormat }
