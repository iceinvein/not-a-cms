const MIN = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

/** Compact relative time: "now", "10s", "15m", "3h", "3d". */
export function relativeTime(at: string, now: number): string {
  const t = Date.parse(at)
  if (Number.isNaN(t)) return ""
  const diff = Math.max(0, now - t)
  if (diff < 5_000) return "now"
  if (diff < MIN) return `${Math.floor(diff / 1000)}s`
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`
  return `${Math.floor(diff / DAY)}d`
}

/** Countdown to a future ISO time as HH:MM:SS, clamped at "00:00:00". */
export function countdown(toIso: string, now: number): string {
  const t = Date.parse(toIso)
  if (Number.isNaN(t)) return "00:00:00"
  let secs = Math.max(0, Math.floor((t - now) / 1000))
  const h = Math.floor(secs / 3600)
  secs -= h * 3600
  const m = Math.floor(secs / 60)
  const s = secs - m * 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}
