export function relativeTime(iso: string, now: Date): string {
  const ms = new Date(iso).getTime() - now.getTime()
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `in ${Math.max(mins, 1)} minute${mins === 1 ? "" : "s"}`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`
  const days = Math.round(hours / 24)
  return `in ${days} day${days === 1 ? "" : "s"}`
}
