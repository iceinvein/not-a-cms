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
  // Rate-limited announcement of newly-arrived events is the responsibility of the
  // surface that composes the Wire (a dedicated polite status region), not this
  // presentational list. Keeping aria-live here would re-announce the full list on
  // every tick as relative timestamps change, flooding screen readers.
  return (
    <ul className="pulse-wire" aria-label="Live activity">
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
