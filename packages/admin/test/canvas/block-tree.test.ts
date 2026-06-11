// packages/admin/test/canvas/block-tree.test.ts
import { describe, expect, test } from "bun:test"
import {
  activeBlockPos,
  gapPosition,
  groupForNode,
  labelForNode,
  planMove,
  topLevelBlocks,
} from "../../src/components/continuum/canvas/block-tree"

/** Build a doc-shaped fixture: forEach yields each node with a running offset and its size. */
function fakeDoc(nodes: Array<{ name: string; attrs?: Record<string, unknown>; size?: number }>) {
  return {
    forEach(fn: (node: any, offset: number, index: number) => void) {
      let offset = 0
      nodes.forEach((n, i) => {
        const size = n.size ?? 1
        fn({ type: { name: n.name }, attrs: n.attrs ?? {}, nodeSize: size }, offset, i)
        offset += size
      })
    },
  }
}

describe("labelForNode", () => {
  test("uses the block spec label for section/field blocks", () => {
    expect(labelForNode({ type: { name: "hero" } })).toBe("Hero")
    expect(labelForNode({ type: { name: "cta" } })).toBe("Call to action")
    expect(labelForNode({ type: { name: "image" } })).toBe("Image")
  })
  test("labels prose nodes from the fallback map", () => {
    expect(labelForNode({ type: { name: "paragraph" } })).toBe("Paragraph")
    expect(labelForNode({ type: { name: "blockquote" } })).toBe("Quote")
    expect(labelForNode({ type: { name: "bulletList" } })).toBe("List")
    expect(labelForNode({ type: { name: "horizontalRule" } })).toBe("Divider")
  })
  test("includes the level for headings, defaulting to 1", () => {
    expect(labelForNode({ type: { name: "heading" }, attrs: { level: 2 } })).toBe("Heading 2")
    expect(labelForNode({ type: { name: "heading" }, attrs: {} })).toBe("Heading 1")
  })
  test("falls back to level 1 for a non-numeric heading level", () => {
    expect(labelForNode({ type: { name: "heading" }, attrs: { level: "two" } })).toBe("Heading 1")
  })
  test("falls back to the raw type name for unknown nodes", () => {
    expect(labelForNode({ type: { name: "mysteryBlock" } })).toBe("mysteryBlock")
  })
})

describe("groupForNode", () => {
  test("returns the spec group for blocks and 'prose' otherwise", () => {
    expect(groupForNode({ type: { name: "hero" } })).toBe("sections")
    expect(groupForNode({ type: { name: "image" } })).toBe("fields")
    expect(groupForNode({ type: { name: "paragraph" } })).toBe("prose")
  })
})

describe("topLevelBlocks", () => {
  test("maps each top-level node to pos, name, label, group, size", () => {
    const blocks = topLevelBlocks(
      fakeDoc([
        { name: "hero", size: 1 },
        { name: "paragraph", size: 3 },
        { name: "heading", attrs: { level: 3 }, size: 2 },
      ]),
    )
    expect(blocks).toEqual([
      { pos: 0, name: "hero", label: "Hero", group: "sections", size: 1 },
      { pos: 1, name: "paragraph", label: "Paragraph", group: "prose", size: 3 },
      { pos: 4, name: "heading", label: "Heading 3", group: "prose", size: 2 },
    ])
  })
  test("returns an empty list for an empty doc", () => {
    expect(topLevelBlocks(fakeDoc([]))).toEqual([])
  })
})

describe("activeBlockPos", () => {
  const blocks = topLevelBlocks(
    fakeDoc([
      { name: "hero", size: 1 },
      { name: "paragraph", size: 3 },
    ]),
  )
  test("returns the pos of the block whose range contains `from`", () => {
    expect(activeBlockPos(blocks, 0)).toBe(0)
    expect(activeBlockPos(blocks, 2)).toBe(1)
  })
  test("attributes the half-open boundary to the next block", () => {
    // hero is [0,1); position 1 is the first position of the paragraph [1,4), not the hero.
    expect(activeBlockPos(blocks, 1)).toBe(1)
  })
  test("returns null when `from` is outside every block", () => {
    expect(activeBlockPos(blocks, 99)).toBeNull()
    expect(activeBlockPos([], 0)).toBeNull()
  })
})

describe("gapPosition", () => {
  // A(pos0,size2) B(pos2,size3) C(pos5,size1); doc content ends at 6.
  const blocks = topLevelBlocks(
    fakeDoc([
      { name: "hero", size: 2 },
      { name: "cta", size: 3 },
      { name: "image", size: 1 },
    ]),
  )
  test("returns the start pos of the block at the gap index", () => {
    expect(gapPosition(blocks, 0)).toBe(0)
    expect(gapPosition(blocks, 1)).toBe(2)
    expect(gapPosition(blocks, 2)).toBe(5)
  })
  test("returns the doc-content end for the trailing gap", () => {
    expect(gapPosition(blocks, 3)).toBe(6)
  })
  test("returns 0 for an empty block list", () => {
    expect(gapPosition([], 0)).toBe(0)
  })
})

describe("planMove", () => {
  const blocks = topLevelBlocks(
    fakeDoc([
      { name: "hero", size: 2 },
      { name: "cta", size: 3 },
      { name: "image", size: 1 },
    ]),
  )
  test("moving the first block after the second maps the insert past the deletion", () => {
    // A -> gap 2 (between B and C). Delete [0,2); B,C shift left by 2; insert at 5-2=3 => [B,A,C].
    expect(planMove(blocks, 0, 2)).toEqual({ delFrom: 0, delTo: 2, insertPos: 3 })
  })
  test("moving the last block to the front keeps the insert before the source", () => {
    // C -> gap 0. Delete [5,6); insert at 0 => [C,A,B].
    expect(planMove(blocks, 2, 0)).toEqual({ delFrom: 5, delTo: 6, insertPos: 0 })
  })
  test("moving the middle block to the end maps past the deletion", () => {
    // B -> gap 3 (end). Delete [2,5); insert at 6-3=3 => [A,C,B].
    expect(planMove(blocks, 1, 3)).toEqual({ delFrom: 2, delTo: 5, insertPos: 3 })
  })
  test("returns null for no-op gaps (same slot or immediately after)", () => {
    expect(planMove(blocks, 0, 0)).toBeNull()
    expect(planMove(blocks, 0, 1)).toBeNull()
    expect(planMove(blocks, 1, 1)).toBeNull()
    expect(planMove(blocks, 1, 2)).toBeNull()
  })
  test("returns null when fromIndex is out of range", () => {
    expect(planMove(blocks, 9, 0)).toBeNull()
  })
})
