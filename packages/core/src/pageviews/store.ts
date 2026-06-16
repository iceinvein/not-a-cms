import { sql } from "drizzle-orm"
import type { AppDatabase } from "../db/connection"

export type PageviewSummary = {
  /** All-time view count for the document. */
  total: number
  /** Views in the current UTC day. */
  today: number
  /** Daily counts for the trailing `days` window, oldest first, zero-filled; the last element is today. */
  series: number[]
}

type PageviewOptions = { days?: number; now?: Date }

const DAY_MS = 86_400_000

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function createPageviewStore(db: AppDatabase) {
  /** Increment the view count for a document in the current UTC day bucket. */
  function record(collection: string, documentId: string, now: Date = new Date()): void {
    const day = dayKey(now)
    db.run(sql`INSERT INTO _pageviews (collection, document_id, day, count)
      VALUES (${collection}, ${documentId}, ${day}, 1)
      ON CONFLICT(collection, document_id, day) DO UPDATE SET count = count + 1`)
  }

  function summary(
    collection: string,
    documentId: string,
    opts: PageviewOptions = {},
  ): PageviewSummary {
    const days = opts.days ?? 14
    const now = opts.now ?? new Date()
    const start = new Date(now.getTime() - (days - 1) * DAY_MS)
    const startDay = dayKey(start)

    const rows = db.all(
      sql`SELECT day, count FROM _pageviews
        WHERE collection = ${collection} AND document_id = ${documentId} AND day >= ${startDay}`,
    ) as Array<{ day: string; count: number }>
    const totalRow = db.all(
      sql`SELECT COALESCE(SUM(count), 0) AS total FROM _pageviews
        WHERE collection = ${collection} AND document_id = ${documentId}`,
    ) as Array<{ total: number }>

    const byDay = new Map(rows.map((r) => [r.day, Number(r.count)]))
    const series: number[] = []
    for (let i = 0; i < days; i++) {
      series.push(byDay.get(dayKey(new Date(start.getTime() + i * DAY_MS))) ?? 0)
    }
    return {
      total: Number(totalRow[0]?.total ?? 0),
      today: byDay.get(dayKey(now)) ?? 0,
      series,
    }
  }

  function summaries(
    collection: string,
    documentIds: string[],
    opts: PageviewOptions = {},
  ): Record<string, PageviewSummary> {
    const result: Record<string, PageviewSummary> = {}
    for (const id of documentIds) result[id] = summary(collection, id, opts)
    return result
  }

  return { record, summary, summaries }
}

export type PageviewStore = ReturnType<typeof createPageviewStore>
