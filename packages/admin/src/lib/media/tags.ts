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

export function filterByTags(items: AdminMediaItem[], tags: string[]): AdminMediaItem[] {
  if (tags.length === 0) return items
  return items.filter((item) => tags.every((tag) => (item.tags ?? []).includes(tag)))
}

export function filterUntagged(items: AdminMediaItem[]): AdminMediaItem[] {
  return items.filter((item) => (item.tags ?? []).length === 0)
}

export function untaggedCount(items: AdminMediaItem[]): number {
  return filterUntagged(items).length
}
