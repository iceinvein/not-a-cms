// packages/admin/test/canvas/canvas-ops.test.ts
import { describe, expect, test } from "bun:test"
import { topLevelBlocks } from "../../src/components/continuum/canvas/block-tree"
import {
  insertBlockAt,
  moveBlock,
  scrollBlockIntoView,
  selectBlockAt,
} from "../../src/components/continuum/canvas/canvas-ops"

describe("selectBlockAt", () => {
  test("creates a node selection at the given position", () => {
    const calls: number[] = []
    const editor = {
      commands: {
        setNodeSelection: (pos: number) => {
          calls.push(pos)
          return true
        },
      },
    }
    selectBlockAt(editor, 6)
    expect(calls).toEqual([6])
  })
})

describe("scrollBlockIntoView", () => {
  test("scrolls the node's DOM into view when available", () => {
    let scrolled = false
    const editor = {
      commands: { setNodeSelection: () => true },
      view: {
        nodeDOM: () => ({
          scrollIntoView: () => {
            scrolled = true
          },
        }),
      },
    }
    scrollBlockIntoView(editor, 0)
    expect(scrolled).toBe(true)
  })
  test("is a no-op when the node DOM is missing", () => {
    const editor = { commands: { setNodeSelection: () => true }, view: { nodeDOM: () => null } }
    expect(() => scrollBlockIntoView(editor, 0)).not.toThrow()
  })
})

/** A mock editor that records the chain commands moveBlock/insertBlockAt issue. */
function recordingEditor(nodeJSON: unknown) {
  const calls: unknown[][] = []
  const chain = {
    focus() {
      calls.push(["focus"])
      return chain
    },
    deleteRange(range: { from: number; to: number }) {
      calls.push(["deleteRange", range])
      return chain
    },
    insertContentAt(pos: number, content: unknown) {
      calls.push(["insertContentAt", pos, content])
      return chain
    },
    run() {
      calls.push(["run"])
      return true
    },
  }
  return {
    calls,
    commands: { setNodeSelection: () => true },
    state: { doc: { nodeAt: () => (nodeJSON ? { toJSON: () => nodeJSON } : null) } },
    chain: () => chain,
  }
}

const fakeBlocks = topLevelBlocks({
  forEach(fn: (node: any, offset: number, index: number) => void) {
    let offset = 0
    for (const [i, n] of [
      { name: "hero", size: 2 },
      { name: "cta", size: 3 },
      { name: "image", size: 1 },
    ].entries()) {
      fn({ type: { name: n.name }, attrs: {}, nodeSize: n.size }, offset, i)
      offset += n.size
    }
  },
})

describe("insertBlockAt", () => {
  test("inserts a bare block of the given type at the position", () => {
    const ed = recordingEditor(null)
    insertBlockAt(ed as never, 5, "cta")
    expect(ed.calls).toEqual([["insertContentAt", 5, { type: "cta" }], ["run"]])
  })
})

describe("moveBlock", () => {
  test("deletes the source node and re-inserts its JSON at the mapped position", () => {
    const heroJSON = { type: "hero", attrs: { headline: "Hi" } }
    const ed = recordingEditor(heroJSON)
    const ok = moveBlock(ed as never, fakeBlocks, 0, 2) // A -> gap 2 => delete [0,2), insert at 3
    expect(ok).toBe(true)
    expect(ed.calls).toEqual([
      ["deleteRange", { from: 0, to: 2 }],
      ["insertContentAt", 3, heroJSON],
      ["run"],
    ])
  })
  test("is a no-op (no chain) for a same-slot move", () => {
    const ed = recordingEditor({ type: "hero" })
    const ok = moveBlock(ed as never, fakeBlocks, 0, 1)
    expect(ok).toBe(false)
    expect(ed.calls).toEqual([])
  })
  test("is a no-op when the source node cannot be read", () => {
    const ed = recordingEditor(null) // nodeAt returns null
    const ok = moveBlock(ed as never, fakeBlocks, 0, 2)
    expect(ok).toBe(false)
    expect(ed.calls).toEqual([])
  })
})
