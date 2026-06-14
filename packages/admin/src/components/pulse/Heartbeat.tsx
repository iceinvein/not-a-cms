import { beatIntervalMs } from "../../lib/pulse/activity"
import type { ActivityLevel } from "../../lib/pulse/types"

export function Heartbeat({
  level,
  eventsPerMin,
}: {
  level: ActivityLevel
  eventsPerMin?: number
}) {
  const rate = typeof eventsPerMin === "number" ? `${Math.round(eventsPerMin)}/min` : null
  const label = rate ? `${level} · ${rate}` : level
  return (
    <span
      className="pulse-heartbeat"
      role="status"
      aria-label={`Site activity: ${label}`}
      style={{ ["--pulse-beat" as never]: `${beatIntervalMs(level)}ms` }}
    >
      <span className="pulse-dot" aria-hidden="true" />
      <span className="pulse-heartbeat-label">{label}</span>
    </span>
  )
}
