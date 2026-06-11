// packages/admin/test/canvas/overlay-geometry.test.ts
import { describe, expect, test } from "bun:test"
import {
  boxAtPoint,
  computeBlockBoxes,
  computeGapZones,
  nearestGap,
} from "../../src/components/continuum/canvas/overlay-geometry"

const blocks = [
  { pos: 0, name: "hero", label: "Hero", group: "sections", size: 1 },
  { pos: 2, name: "paragraph", label: "Paragraph", group: "prose", size: 3 },
]

describe("computeBlockBoxes", () => {
  test("positions each box relative to the container origin", () => {
    const rects: Record<number, { top: number; left: number; width: number; height: number }> = {
      0: { top: 100, left: 40, width: 600, height: 300 },
      2: { top: 420, left: 40, width: 600, height: 80 },
    }
    const boxes = computeBlockBoxes(blocks, (pos) => rects[pos] ?? null, { top: 80, left: 20 })
    expect(boxes).toEqual([
      { pos: 0, name: "hero", label: "Hero", box: { top: 20, left: 20, width: 600, height: 300 } },
      {
        pos: 2,
        name: "paragraph",
        label: "Paragraph",
        box: { top: 340, left: 20, width: 600, height: 80 },
      },
    ])
  })
  test("skips blocks that have no rect yet", () => {
    const boxes = computeBlockBoxes(
      blocks,
      (pos) => (pos === 0 ? { top: 100, left: 40, width: 600, height: 300 } : null),
      { top: 0, left: 0 },
    )
    expect(boxes).toHaveLength(1)
    expect(boxes[0]?.pos).toBe(0)
  })
})

describe("boxAtPoint", () => {
  const boxes = [
    { pos: 0, name: "hero", label: "Hero", box: { top: 0, left: 0, width: 100, height: 50 } },
    {
      pos: 2,
      name: "paragraph",
      label: "Paragraph",
      box: { top: 60, left: 0, width: 100, height: 40 },
    },
  ]
  test("returns the box containing the point", () => {
    expect(boxAtPoint(boxes, 10, 10)?.pos).toBe(0)
    expect(boxAtPoint(boxes, 10, 70)?.pos).toBe(2)
  })
  test("returns null when no box contains the point", () => {
    expect(boxAtPoint(boxes, 10, 55)).toBeNull()
    expect(boxAtPoint(boxes, 200, 10)).toBeNull()
  })
})

describe("computeGapZones", () => {
  const boxes = [
    { pos: 0, name: "hero", label: "Hero", box: { top: 0, left: 0, width: 100, height: 50 } },
    { pos: 2, name: "cta", label: "CTA", box: { top: 60, left: 0, width: 100, height: 40 } },
  ]
  test("emits a leading gap, between-gaps at midpoints, and a trailing gap", () => {
    expect(computeGapZones(boxes)).toEqual([
      { index: 0, y: 0 }, // top of first box
      { index: 1, y: 55 }, // midpoint of (0+50) bottom and 60 top
      { index: 2, y: 100 }, // bottom of last box
    ])
  })
  test("returns no zones for an empty box list", () => {
    expect(computeGapZones([])).toEqual([])
  })
})

describe("nearestGap", () => {
  const gaps = [
    { index: 0, y: 0 },
    { index: 1, y: 55 },
    { index: 2, y: 100 },
  ]
  test("returns the closest gap within the threshold", () => {
    expect(nearestGap(gaps, 52, 24)?.index).toBe(1)
    expect(nearestGap(gaps, 4, 24)?.index).toBe(0)
  })
  test("returns null when no gap is within the threshold", () => {
    expect(nearestGap(gaps, 30, 10)).toBeNull()
  })
})
