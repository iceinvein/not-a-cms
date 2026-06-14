/** The kinds of event that flow through the Wire. */
export type PulseEventType = "publish" | "edit" | "run" | "alert"

/** One entry in the live change stream. */
export type PulseEvent = {
  id: string
  type: PulseEventType
  actor?: string | null
  /** Human-readable tail, e.g. "published Pricing page". */
  summary: string
  href?: string | null
  /** ISO timestamp. */
  at: string
}

/** Coarse activity buckets driving the heartbeat rate. */
export type ActivityLevel = "idle" | "steady" | "brisk"

/** The status a row or item can signal. */
export type StatusKind =
  | "draft"
  | "in_review"
  | "scheduled"
  | "published"
  | "expiring"
  | "failed"
  | "dormant"
