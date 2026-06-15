import { activityLevel } from "../../lib/pulse/activity"
import type { SpinePerson } from "../../lib/pulse/presence"
import type { PulseEvent } from "../../lib/pulse/types"
import { Heartbeat } from "./Heartbeat"
import { PresenceDots } from "./PresenceDots"
import { WireTicker } from "./WireTicker"

/** The living spine, driven entirely by props (no fetching) so it is testable.
 *  `eventsPerMin` is null until the first heartbeat frame arrives. */
export function PulseSpineView({
  eventsPerMin,
  latestEvent,
  people,
  now,
}: {
  eventsPerMin: number | null
  latestEvent: PulseEvent | null
  people: SpinePerson[]
  now: number
}) {
  return (
    <div className="pulse-spine">
      <Heartbeat level={activityLevel(eventsPerMin ?? 0)} eventsPerMin={eventsPerMin ?? undefined} />
      <WireTicker event={latestEvent} now={now} />
      {people.length > 0 ? <PresenceDots people={people} /> : null}
    </div>
  )
}
