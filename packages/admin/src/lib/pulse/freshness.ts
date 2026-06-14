const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

/**
 * Glow intensity in [0, 1] for a recently-updated row. Full intensity at the
 * moment of edit, linearly decaying to 0 across `windowMs` (default 6h).
 * Future timestamps clamp to 1; unparseable timestamps return 0.
 */
export function freshnessIntensity(
  updatedAt: string,
  now: number,
  windowMs: number = 6 * HOUR_MS,
): number {
  const t = Date.parse(updatedAt)
  if (Number.isNaN(t)) return 0
  const age = now - t
  if (age <= 0) return 1
  if (age >= windowMs) return 0
  return 1 - age / windowMs
}

/** True when a row has not changed within `dormantDays` (default 30). */
export function isDormant(updatedAt: string, now: number, dormantDays = 30): boolean {
  const t = Date.parse(updatedAt)
  if (Number.isNaN(t)) return false
  return now - t >= dormantDays * DAY_MS
}
