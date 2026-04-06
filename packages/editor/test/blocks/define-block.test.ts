import { test, expect, describe } from "bun:test"
import { defineBlock } from "../../src/blocks/define-block"

// Minimal mock component for tests (no actual React rendering needed)
const MockEditor = () => null

describe("defineBlock", () => {
  test("returns a definition with a Tiptap extension", () => {
    const block = defineBlock({
      name: "test-block",
      label: "Test Block",
      schema: { title: { type: "text", default: "Hello" } },
      editor: MockEditor,
    })
    expect(block.extension).toBeDefined()
    expect(block.extension.name).toBe("test-block")
  })

  test("extension has correct name", () => {
    const block = defineBlock({
      name: "pricing-table",
      label: "Pricing Table",
      schema: {},
      editor: MockEditor,
    })
    expect(block.extension.name).toBe("pricing-table")
  })

  test("preserves all definition properties", () => {
    const toPT = (attrs: any) => ({ type: "custom", ...attrs })
    const block = defineBlock({
      name: "my-block",
      label: "My Block",
      icon: "star",
      group: "commerce",
      schema: { price: { type: "number", default: 0 } },
      editor: MockEditor,
      toPortableText: toPT,
    })
    expect(block.label).toBe("My Block")
    expect(block.icon).toBe("star")
    expect(block.group).toBe("commerce")
    expect(block.toPortableText).toBe(toPT)
    expect(block.schema.price.type).toBe("number")
    expect(block.schema.price.default).toBe(0)
  })

  test("multiple blocks can be defined without conflicts", () => {
    const block1 = defineBlock({
      name: "block-a",
      label: "Block A",
      schema: { x: { type: "text" } },
      editor: MockEditor,
    })
    const block2 = defineBlock({
      name: "block-b",
      label: "Block B",
      schema: { y: { type: "number", default: 42 } },
      editor: MockEditor,
    })
    expect(block1.extension.name).toBe("block-a")
    expect(block2.extension.name).toBe("block-b")
    expect(block1.extension).not.toBe(block2.extension)
  })
})
