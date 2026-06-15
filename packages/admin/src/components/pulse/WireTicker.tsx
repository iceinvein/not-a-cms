import { relativeTime } from "../../lib/pulse/format"
import type { PulseEvent } from "../../lib/pulse/types"

/** A single compact rolling line for the spine: the most recent activity event,
 *  or a calm idle label when nothing has happened. Not a live region (the spine
 *  heartbeat carries the role=status); this avoids screen-reader flooding. */
export function WireTicker({ event, now }: { event: PulseEvent | null; now: number }) {
  if (!event) {
    return <span className="pulse-wire-ticker pulse-wire-ticker-idle">All quiet</span>
  }
  const when = relativeTime(event.at, now)
  return (
    <span className="pulse-wire-ticker" title={event.summary}>
      <span className={`pulse-wire-dot pulse-wire-dot-${event.type}`} aria-hidden="true" />
      <span className="pulse-wire-ticker-text">
        {event.actor ? <b>{event.actor} </b> : null}
        {event.summary}
      </span>
      {when ? <span className="pulse-wire-time">{when}</span> : null}
    </span>
  )
}
