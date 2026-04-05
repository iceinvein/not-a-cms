import { mkdirSync, existsSync, unlinkSync } from "node:fs"
import { join } from "node:path"

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
}

export function createLocalStorage(config: StorageConfig) {
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
      records.delete(id)
      return true
    },
  }
}
