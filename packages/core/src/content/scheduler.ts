import type { createContentService } from "./service"
import type { CollectionDef } from "../types"

type CollectionEntry = {
  def: CollectionDef
  table: any
  service: ReturnType<typeof createContentService>
}

export function createScheduler(collections: Map<string, CollectionEntry>) {
  async function promoteScheduled(): Promise<Record<string, unknown>[]> {
    const now = new Date().toISOString()
    const promoted: Record<string, unknown>[] = []

    for (const [, entry] of collections) {
      const { service } = entry
      const all = await service.findMany({ where: { status: "scheduled" } })
      for (const doc of all) {
        const publishedAt = doc.published_at as string | null
        if (publishedAt && publishedAt <= now) {
          const updated = await service.update(doc.id as string, { status: "published" })
          promoted.push(updated)
        }
      }
    }

    return promoted
  }

  return { promoteScheduled }
}

export type Scheduler = ReturnType<typeof createScheduler>
