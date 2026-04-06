import { mkdirSync, existsSync, unlinkSync, rmSync } from "node:fs"
import { join } from "node:path"
import type { ImageOptimizer, ImageVariant } from "./optimizer"

export type StorageConfig = {
  provider: "local"
  path: string
}

export type MediaRecord = {
  id: string
  filename: string
  mimetype: string
  size: number
  path: string
  uploadedAt: string
  width?: number
  height?: number
  blurDataURL?: string
  variants?: ImageVariant[]
}

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "image/svg+xml"])

export function createLocalStorage(config: StorageConfig, optimizer?: ImageOptimizer) {
  const baseDir = config.path
  if (!existsSync(baseDir)) mkdirSync(baseDir, { recursive: true })

  const records = new Map<string, MediaRecord>()

  return {
    async store(file: File): Promise<MediaRecord> {
      const id = crypto.randomUUID()
      const ext = file.name.split(".").pop() || ""
      const storedName = `${id}${ext ? "." + ext : ""}`
      const filePath = join(baseDir, storedName)

      const buffer = await file.arrayBuffer()
      await Bun.write(filePath, buffer)

      const record: MediaRecord = {
        id,
        filename: file.name,
        mimetype: file.type,
        size: file.size,
        path: filePath,
        uploadedAt: new Date().toISOString(),
      }

      // Optimize images
      if (optimizer && IMAGE_MIMES.has(file.type) && file.type !== "image/svg+xml") {
        try {
          const result = await optimizer.processImage(filePath, id)
          record.width = result.width
          record.height = result.height
          record.blurDataURL = result.blurDataURL
          record.variants = result.variants
        } catch {
          // Optimization failed — serve original
        }
      }

      records.set(id, record)
      return record
    },

    list(): MediaRecord[] {
      return Array.from(records.values())
    },

    get(id: string): MediaRecord | null {
      return records.get(id) ?? null
    },

    remove(id: string): boolean {
      const record = records.get(id)
      if (!record) return false
      try { unlinkSync(record.path) } catch {}
      try { rmSync(join(baseDir, id), { recursive: true }) } catch {}
      records.delete(id)
      return true
    },
  }
}
