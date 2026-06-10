import { describe, expect, test } from "bun:test"
import { continuumBlocks } from "../../src/components/continuum/blocks"
import { LIVING_VIEWS, livingBlocks } from "../../src/components/continuum/canvas/living-blocks"

describe("livingBlocks", () => {
  test("declares the same node names and schemas as the form blocks", () => {
    const living = livingBlocks.map((b) => b.name).sort()
    const form = continuumBlocks.map((b) => b.name).sort()
    expect(living).toEqual(form)
    for (const block of livingBlocks) {
      const formBlock = continuumBlocks.find((b) => b.name === block.name)!
      expect(Object.keys(block.schema).sort()).toEqual(Object.keys(formBlock.schema).sort())
    }
  })

  test("registers living views for the Phase 2A blocks", () => {
    expect(Object.keys(LIVING_VIEWS).sort()).toEqual(["cta", "featureGrid", "hero", "stats"])
  })
})
