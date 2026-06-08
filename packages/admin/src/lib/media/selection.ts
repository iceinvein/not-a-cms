// Returns the inclusive run of ids between the anchor and target in render order.
// Falls back to just the target when there is no usable anchor.
export function rangeBetween(
  orderedIds: string[],
  anchorId: string | null,
  targetId: string,
): string[] {
  const target = orderedIds.indexOf(targetId)
  if (target === -1) return []
  const anchor = anchorId === null ? -1 : orderedIds.indexOf(anchorId)
  if (anchor === -1) return [targetId]
  const [start, end] = anchor <= target ? [anchor, target] : [target, anchor]
  return orderedIds.slice(start, end + 1)
}
