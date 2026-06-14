import { countdown } from "../../lib/pulse/format"
import type { StatusKind } from "../../lib/pulse/types"

const BASE_LABEL: Record<StatusKind, string> = {
  draft: "draft",
  in_review: "in review",
  scheduled: "scheduled",
  published: "published",
  expiring: "expiring",
  failed: "failed",
  dormant: "dormant",
}

export function StatusSignal({
  kind,
  at,
  now,
  label,
}: {
  kind: StatusKind
  at?: string
  now?: number
  label?: string
}) {
  const text = label ?? signalText(kind, at, now)
  return (
    <span className={`pulse-signal pulse-signal-${kind}`} data-kind={kind}>
      {text}
    </span>
  )
}

function signalText(kind: StatusKind, at?: string, now?: number): string {
  if (kind === "scheduled" && at != null && now != null) {
    return `live in ${countdown(at, now)}`
  }
  if (kind === "expiring" && at != null && now != null) {
    const days = Math.max(0, Math.ceil((Date.parse(at) - now) / 86_400_000))
    return `expires ${days}d`
  }
  return BASE_LABEL[kind]
}
