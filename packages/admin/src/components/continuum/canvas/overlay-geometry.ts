// packages/admin/src/components/continuum/canvas/overlay-geometry.ts
import type { BlockTreeNode } from "./block-tree"

export type RectLike = { top: number; left: number; width: number; height: number }
export type BlockBox = { pos: number; name: string; label: string; box: RectLike }

/**
 * Compute outline boxes for each block relative to a container origin. `getRect(pos)` returns
 * the viewport rect of the block's DOM (or null if it has no layout yet); `origin` is the
 * container's viewport rect. Blocks with no rect are skipped. Pure, so the geometry is
 * unit-testable without a real DOM (the overlay supplies real rects at runtime).
 */
export function computeBlockBoxes(
  blocks: BlockTreeNode[],
  getRect: (pos: number) => RectLike | null,
  origin: { top: number; left: number },
): BlockBox[] {
  const boxes: BlockBox[] = []
  for (const block of blocks) {
    const rect = getRect(block.pos)
    if (!rect) continue
    boxes.push({
      pos: block.pos,
      name: block.name,
      label: block.label,
      box: {
        top: rect.top - origin.top,
        left: rect.left - origin.left,
        width: rect.width,
        height: rect.height,
      },
    })
  }
  return boxes
}

/** The first box whose rect contains the container-relative point (x, y), or null. */
export function boxAtPoint(boxes: BlockBox[], x: number, y: number): BlockBox | null {
  for (const b of boxes) {
    const { top, left, width, height } = b.box
    if (x >= left && x <= left + width && y >= top && y <= top + height) return b
  }
  return null
}

/** A gap between (or around) blocks: `index` is the gap index (0..boxes.length), `y` is its
 *  vertical center relative to the stage container. */
export type GapZone = { index: number; y: number }

/** Gap zones for the inserter/placement line: a leading gap above the first box, a gap at the
 *  midpoint between each adjacent pair, and a trailing gap below the last box. */
export function computeGapZones(boxes: BlockBox[]): GapZone[] {
  if (boxes.length === 0) return []
  const zones: GapZone[] = [{ index: 0, y: boxes[0].box.top }]
  for (let i = 1; i < boxes.length; i++) {
    const prev = boxes[i - 1].box
    const cur = boxes[i].box
    zones.push({ index: i, y: (prev.top + prev.height + cur.top) / 2 })
  }
  const last = boxes[boxes.length - 1].box
  zones.push({ index: boxes.length, y: last.top + last.height })
  return zones
}

/** The gap whose center is closest to `y`, or null if none is within `threshold` pixels. */
export function nearestGap(gaps: GapZone[], y: number, threshold: number): GapZone | null {
  let best: GapZone | null = null
  let bestDist = threshold
  for (const g of gaps) {
    const d = Math.abs(g.y - y)
    if (d <= bestDist) {
      bestDist = d
      best = g
    }
  }
  return best
}
