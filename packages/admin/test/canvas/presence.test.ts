// packages/admin/test/canvas/presence.test.ts
import { describe, expect, test } from "bun:test"
import type { BlockTreeNode } from "../../src/components/continuum/canvas/block-tree"
import type { BlockBox } from "../../src/components/continuum/canvas/overlay-geometry"
import { remoteSelectionBoxes } from "../../src/components/continuum/canvas/presence"

const blocks: BlockTreeNode[] = [
  { pos: 0, name: "hero", label: "Hero", group: "sections", size: 4 },
  { pos: 4, name: "cta", label: "Call to action", group: "sections", size: 2 },
]
const boxes: BlockBox[] = [
  { pos: 0, name: "hero", label: "Hero", box: { top: 0, left: 0, width: 600, height: 200 } },
  {
    pos: 4,
    name: "cta",
    label: "Call to action",
    box: { top: 220, left: 0, width: 600, height: 80 },
  },
]

function cursor(clientId: string, head: number, color = "#3b82f6", name = "Remote") {
  return { clientId, user: { name, color }, anchor: head, head }
}

describe("remoteSelectionBoxes", () => {
  test("maps a cursor head to the enclosing block's box", () => {
    const result = remoteSelectionBoxes([cursor("a", 1)], blocks, boxes)
    expect(result).toEqual([
      {
        clientId: "a",
        color: "#3b82f6",
        name: "Remote",
        box: { top: 0, left: 0, width: 600, height: 200 },
      },
    ])
  })

  test("maps a head inside the second block to the second box", () => {
    const result = remoteSelectionBoxes([cursor("b", 5)], blocks, boxes)
    expect(result.map((r) => r.box.top)).toEqual([220])
  })

  test("skips a cursor whose head is outside every block", () => {
    expect(remoteSelectionBoxes([cursor("c", 999)], blocks, boxes)).toEqual([])
  })

  test("keeps one entry per cursor when two share a block", () => {
    const result = remoteSelectionBoxes([cursor("a", 1), cursor("b", 2)], blocks, boxes)
    expect(result).toHaveLength(2)
    expect(result[0].box).toEqual(result[1].box)
  })

  test("sanitizes an unsafe color to the fallback", () => {
    const result = remoteSelectionBoxes([cursor("a", 1, "red; background: url(x)")], blocks, boxes)
    expect(result[0].color).toBe("#38bdf8")
  })
})
