// packages/admin/test/canvas/canvas-ops.test.ts
import { describe, expect, test } from "bun:test"
import {
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
