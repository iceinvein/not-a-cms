import { describe, expect, test } from "bun:test"
import { continuumBlocks } from "../../src/components/continuum/blocks"
import { visualBlocks } from "../../src/components/continuum/canvas/visual-blocks"

describe("visualBlocks", () => {
  test("declares the same node names and attributes as the form blocks", () => {
    const visual = visualBlocks.map((b) => b.name).sort()
    const form = continuumBlocks.map((b) => b.name).sort()
    expect(visual).toEqual(form)

    for (const block of visualBlocks) {
      const formBlock = continuumBlocks.find((b) => b.name === block.name)!
      expect(Object.keys(block.schema).sort()).toEqual(Object.keys(formBlock.schema).sort())
    }
  })
})
