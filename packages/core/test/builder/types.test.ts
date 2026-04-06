import { test, expect, describe } from "bun:test"
import { createEmptySection, createEmptyLayout, DEFAULT_GRID } from "../../src/builder/types"

describe("page layout types", () => {
  test("createEmptySection returns valid section", () => {
    const section = createEmptySection("Hero")
    expect(section._type).toBe("section")
    expect(section._id).toBeDefined()
    expect(section.label).toBe("Hero")
    expect(section.grid).toEqual(DEFAULT_GRID)
    expect(section.children).toEqual([])
  })

  test("createEmptyLayout returns page with one section", () => {
    const layout = createEmptyLayout()
    expect(layout._type).toBe("page")
    expect(layout.sections).toHaveLength(1)
    expect(layout.sections[0].label).toBe("Main")
  })

  test("section IDs are unique", () => {
    const a = createEmptySection()
    const b = createEmptySection()
    expect(a._id).not.toBe(b._id)
  })
})
