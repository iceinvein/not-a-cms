import { relativeTime } from "./relative-time"

type Metrics = {
  collections: Array<{ name: string; label: string; inReview: number }>
}

type FailedRun = {
  id: string
  flow_id: string
  status: string
  error?: string
  started_at: string
}

export type ExpiringItem = {
  collection: string
  documentId: string
  title: string
  unpublishAt: string
}

export type NeedsYouItem = {
  kind: "failed_run" | "expiring" | "review"
  title: string
  sub?: string
  label?: string
  href: string
  action: string
  severity: "error" | "info"
}

export function toNeedsYouItems(
  metrics: Metrics,
  failedRuns: FailedRun[],
  expiringItems: ExpiringItem[] = [],
  now = new Date(),
): NeedsYouItem[] {
  const items: NeedsYouItem[] = []

  for (const run of failedRuns) {
    items.push({
      kind: "failed_run",
      title: "Automation run failed",
      sub: run.error ?? "see run details",
      href: `/automations/${run.flow_id}?run=${run.id}`,
      action: "inspect",
      severity: "error",
    })
  }

  for (const item of expiringItems) {
    items.push({
      kind: "expiring",
      title: `${item.title} expires ${relativeTime(item.unpublishAt, now)}`,
      sub: "scheduled to archive",
      href: `/content/${item.collection}/${item.documentId}`,
      action: "extend",
      severity: "info",
    })
  }

  for (const collection of metrics.collections) {
    if (collection.inReview <= 0) continue
    items.push({
      kind: "review",
      title: `Review ${collection.inReview} ${collection.label}`,
      label: collection.label,
      href: `/content/${collection.name}?where=${encodeURIComponent(JSON.stringify({ status: "in_review" }))}`,
      action: "review",
      severity: "info",
    })
  }

  return items
}
