import { useEffect, useState } from "react"
import { adminApiFetch, joinAdminApiUrl } from "../../lib/api"
import type { PresenceRoomView } from "../../lib/desk/live"
import { presenceToPeople, type SpinePerson } from "../../lib/pulse/presence"
import type { PulseEvent } from "../../lib/pulse/types"
import { PulseSpineView } from "./PulseSpineView"

const PRESENCE_POLL_MS = 8_000
const NOW_TICK_MS = 15_000

/** Client island for the app-shell spine. Owns the live wiring: an SSE feed for
 *  the heartbeat rate + latest event, and a presence poll for the avatars. */
export function PulseSpine({ apiBase = "" }: { apiBase?: string }) {
  const [eventsPerMin, setEventsPerMin] = useState<number | null>(null)
  const [latestEvent, setLatestEvent] = useState<PulseEvent | null>(null)
  const [people, setPeople] = useState<SpinePerson[]>([])
  const [now, setNow] = useState(() => Date.now())

  // Live feed: heartbeat rate + latest activity event.
  useEffect(() => {
    let source: EventSource | null = null
    try {
      source = new EventSource(joinAdminApiUrl(apiBase, "/api/_pulse"), { withCredentials: true })
    } catch {
      return // EventSource unavailable: the spine stays calm/idle.
    }
    const onHeartbeat = (event: Event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data)
        if (typeof data?.eventsPerMin === "number") setEventsPerMin(data.eventsPerMin)
      } catch {
        /* ignore a malformed frame */
      }
    }
    const onPulse = (event: Event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as PulseEvent
        setLatestEvent(data)
        setNow(Date.now())
      } catch {
        /* ignore a malformed frame */
      }
    }
    source.addEventListener("heartbeat", onHeartbeat)
    source.addEventListener("pulse", onPulse)
    return () => {
      source?.removeEventListener("heartbeat", onHeartbeat)
      source?.removeEventListener("pulse", onPulse)
      source?.close()
    }
  }, [apiBase])

  // Presence: poll the existing endpoint, skipping when the tab is hidden.
  useEffect(() => {
    let cancelled = false
    async function fetchPresence() {
      if (typeof document !== "undefined" && document.hidden) return
      try {
        const res = await adminApiFetch(apiBase, "/api/_presence")
        if (!res.ok) return
        const body = (await res.json()) as { rooms?: PresenceRoomView[] }
        if (!cancelled) setPeople(presenceToPeople(body.rooms ?? []))
      } catch {
        if (!cancelled) setPeople([])
      }
    }
    fetchPresence()
    const timer = setInterval(fetchPresence, PRESENCE_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [apiBase])

  // Advance `now` slowly so the ticker's relative time stays fresh without
  // per-second churn (which would also be noise for assistive tech).
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), NOW_TICK_MS)
    return () => clearInterval(timer)
  }, [])

  return (
    <PulseSpineView
      eventsPerMin={eventsPerMin}
      latestEvent={latestEvent}
      people={people}
      now={now}
    />
  )
}
