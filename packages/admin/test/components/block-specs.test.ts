import { describe, expect, test } from "bun:test"
import { continuumBlocks } from "../../src/components/continuum/blocks"
import { blockSpecs } from "../../src/components/continuum/blocks/specs"

describe("block specs", () => {
  test("specs cover every Continuum block with matching schema keys", () => {
    const specNames = blockSpecs.map((s) => s.name).sort()
    const blockNames = continuumBlocks.map((b) => b.name).sort()
    expect(specNames).toEqual(blockNames)

    for (const block of continuumBlocks) {
      const spec = blockSpecs.find((s) => s.name === block.name)
      expect(spec).toBeDefined()
      expect(Object.keys(block.schema).sort()).toEqual(Object.keys(spec!.schema).sort())
    }
  })

  test("hero spec keeps its known fields", () => {
    const hero = blockSpecs.find((s) => s.name === "hero")
    expect(hero?.schema.headline).toEqual({ type: "text", default: "" })
    expect(hero?.schema.align).toEqual({
      type: "select",
      default: "center",
      options: ["center", "left"],
    })
  })
})
