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

export type NeedsYouItem = {
  kind: "failed_run" | "review"
  title: string
  sub?: string
  label?: string
  href: string
  action: string
  severity: "error" | "info"
}

export function toNeedsYouItems(metrics: Metrics, failedRuns: FailedRun[]): NeedsYouItem[] {
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
