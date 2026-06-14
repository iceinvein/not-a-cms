import { relativeTime } from "../../lib/pulse/format"
import type { PulseEvent } from "../../lib/pulse/types"

export function Wire({
  events,
  now,
  max = 7,
}: {
  events: PulseEvent[]
  now: number
  max?: number
}) {
  const shown = events.slice(0, max)
  return (
    <ul className="pulse-wire" aria-label="Live activity" aria-live="polite">
      {shown.map((e) => (
        <li key={e.id} className={`pulse-wire-item pulse-wire-${e.type}`}>
          <span className={`pulse-wire-dot pulse-wire-dot-${e.type}`} aria-hidden="true" />
          <span className="pulse-wire-text">
            {e.actor ? <b>{e.actor}</b> : null}
            {e.actor ? " " : ""}
            {e.summary}
          </span>
          <span className="pulse-wire-time">{relativeTime(e.at, now)}</span>
        </li>
      ))}
    </ul>
  )
}
