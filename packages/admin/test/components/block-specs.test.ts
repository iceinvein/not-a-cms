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

describe("inlineText metadata", () => {
  test("hero marks its visible text as inline", () => {
    const hero = blockSpecs.find((s) => s.name === "hero")
    expect(hero?.inlineText).toEqual(["eyebrow", "headline", "subheadline"])
  })

  test("cta marks its label as inline", () => {
    const cta = blockSpecs.find((s) => s.name === "cta")
    expect(cta?.inlineText).toEqual(["label"])
  })

  test("featureGrid has no top-level inline text (its text lives in items)", () => {
    const fg = blockSpecs.find((s) => s.name === "featureGrid")
    expect(fg?.inlineText ?? []).toEqual([])
  })

  test("every inlineText key is a real text field on its block", () => {
    for (const spec of blockSpecs) {
      for (const key of spec.inlineText ?? []) {
        expect(spec.schema[key]?.type).toBe("text")
      }
    }
  })
})
