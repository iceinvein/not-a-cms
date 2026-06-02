import type { AdminMediaItem } from "../media"

export function allTags(items: AdminMediaItem[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    for (const tag of item.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag))
}

export function filterByTag(items: AdminMediaItem[], tag: string | null): AdminMediaItem[] {
  if (!tag) return items
  return items.filter((item) => (item.tags ?? []).includes(tag))
}
