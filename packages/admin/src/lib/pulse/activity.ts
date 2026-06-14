import type { ActivityLevel } from "./types"

/** Bucket a trailing events-per-minute rate into a coarse activity level. */
export function activityLevel(eventsPerMin: number): ActivityLevel {
  if (!Number.isFinite(eventsPerMin) || eventsPerMin < 1) return "idle"
  if (eventsPerMin < 4) return "steady"
  return "brisk"
}

/** Heartbeat interval in ms for a level. Capped at 1000ms so it never strobes. */
export function beatIntervalMs(level: ActivityLevel): number {
  switch (level) {
    case "brisk":
      return 1000
    case "steady":
      return 1500
    default:
      return 2200
  }
}
