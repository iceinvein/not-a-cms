type Candidate = {
  id?: string
  tags?: unknown
  created_at?: string
  publishedAt?: string
  [k: string]: unknown
}

/**
 * Return up to `limit` posts related to `current` from `candidates`.
 *
 * Ranking: shared-tag count DESC, then date DESC (publishedAt ?? created_at).
 * When no candidate shares a tag the sort degrades to pure recency, giving
 * a sensible recency-based fallback at zero cost.
 *
 * The current post (matched by `id`) is always excluded.
 */
export function relatedPosts<T extends Candidate>(
  current: { id?: string; tags?: unknown },
  candidates: T[],
  limit = 3,
): T[] {
  const currentTags = toStringArray(current.tags)

  return candidates
    .filter((c) => c.id !== current.id)
    .map((c) => ({
      item: c,
      overlap: sharedTagCount(currentTags, toStringArray(c.tags)),
      date: resolveDate(c),
    }))
    .sort((a, b) => {
      if (b.overlap !== a.overlap) return b.overlap - a.overlap
      return b.date - a.date
    })
    .slice(0, limit)
    .map((e) => e.item)
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => String(v))
}

function sharedTagCount(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setA = new Set(a)
  return b.filter((t) => setA.has(t)).length
}

function resolveDate(c: Candidate): number {
  const raw = c.publishedAt ?? c.created_at
  if (!raw) return 0
  const ms = Date.parse(String(raw))
  return Number.isNaN(ms) ? 0 : ms
}
