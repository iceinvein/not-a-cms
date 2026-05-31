import type { createContentService } from "./service"
import type { CollectionDef } from "../types"

type CollectionEntry = {
  def: CollectionDef
  table: any
  service: ReturnType<typeof createContentService>
}

const ELIGIBLE_STATUSES = ["draft", "in_review", "scheduled"]

export function createScheduler(collections: Map<string, CollectionEntry>) {
  async function promoteScheduled(now = new Date()): Promise<Record<string, unknown>[]> {
    const nowTime = now.getTime()
    const promoted: Record<string, unknown>[] = []

    for (const [, entry] of collections) {
      const { def, service } = entry
      if (!def.fields.status || !findPublishField(def)) continue

      const all = await service.findMany({ where: { status: { in: ELIGIBLE_STATUSES } } })
      for (const doc of all) {
        const publishedAt = (doc.publishedAt ?? doc.published_at) as string | null
        if (isDue(publishedAt, nowTime)) {
          const updated = await service.transitionStatus(doc.id as string, "publish", "admin")
          promoted.push(updated)
        }
      }
    }

    return promoted
  }

  return { promoteScheduled }
}

export type Scheduler = ReturnType<typeof createScheduler>

function findPublishField(def: CollectionDef): string | null {
  if (def.fields.publishedAt) return "publishedAt"
  if (def.fields.published_at) return "published_at"
  return null
}

function isDue(value: unknown, nowTime: number): boolean {
  if (typeof value !== "string" || value.trim() === "") return false
  const publishTime = new Date(value).getTime()
  return Number.isFinite(publishTime) && publishTime <= nowTime
}
