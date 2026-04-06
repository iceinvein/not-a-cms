import sharp from "sharp"
import { join } from "node:path"
import { mkdirSync } from "node:fs"

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
          const pipeline = sharp(inputPath).resize(width, height, { fit: "inside", withoutEnlargement: true })

          let result
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

  return { processImage }
}

export type ImageOptimizer = ReturnType<typeof createImageOptimizer>
export type { ProcessResult, ImageVariant }
