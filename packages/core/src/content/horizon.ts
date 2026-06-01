import type { ContentStatus } from "../types"

export type HorizonItem = {
  collection: string
  documentId: string
  title: string
  publishedAt: string | null
  status: ContentStatus | string
  channels?: string[]
}

export type Horizon = {
  now: HorizonItem[]
  today: HorizonItem[]
  week: HorizonItem[]
  later: HorizonItem[]
}

export function bucketHorizon(items: HorizonItem[], now: Date): Horizon {
  const nowMs = now.getTime()
  const startOfTomorrow = new Date(now)
  startOfTomorrow.setUTCHours(24, 0, 0, 0)
  const tomorrowMs = startOfTomorrow.getTime()
  const weekMs = nowMs + 7 * 24 * 60 * 60 * 1000
  const out: Horizon = { now: [], today: [], week: [], later: [] }

  for (const item of items) {
    if (!item.publishedAt) continue
    const publishedMs = new Date(item.publishedAt).getTime()
    if (Number.isNaN(publishedMs)) continue

    if (publishedMs <= nowMs) out.now.push(item)
    else if (publishedMs < tomorrowMs) out.today.push(item)
    else if (publishedMs < weekMs) out.week.push(item)
    else out.later.push(item)
  }

  const byDate = (a: HorizonItem, b: HorizonItem) =>
    new Date(a.publishedAt!).getTime() - new Date(b.publishedAt!).getTime()
  out.now.sort(byDate)
  out.today.sort(byDate)
  out.week.sort(byDate)
  out.later.sort(byDate)
  return out
}
