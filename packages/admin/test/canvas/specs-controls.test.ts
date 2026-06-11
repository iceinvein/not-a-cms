// packages/admin/test/canvas/specs-controls.test.ts
import { describe, expect, test } from "bun:test"
import { blockSpecs } from "../../src/components/continuum/blocks/specs"

const byName = (name: string) => blockSpecs.find((s) => s.name === name)
const SECTIONS = [
  "hero",
  "cta",
  "featureGrid",
  "stats",
  "logoCloud",
  "splitMedia",
  "testimonial",
  "faq",
  "pricingCards",
  "collectionList",
]

describe("variantField/columnField hints", () => {
  test("variant selects are flagged on the right blocks", () => {
    expect(byName("hero")?.variantField).toBe("align")
    expect(byName("cta")?.variantField).toBe("variant")
    expect(byName("splitMedia")?.variantField).toBe("side")
    expect(byName("collectionList")?.variantField).toBe("layout")
  })
  test("column fields are flagged on the grid blocks", () => {
    expect(byName("featureGrid")?.columnField).toBe("columns")
    expect(byName("stats")?.columnField).toBe("columns")
  })
})

describe("spacing schema", () => {
  test("every section-group block has the spacing select defaulting to normal", () => {
    for (const name of SECTIONS) {
      const spec = byName(name)
      expect(spec?.group).toBe("sections")
      expect(spec?.schema.spacing).toEqual({
        type: "select",
        default: "normal",
        options: ["none", "compact", "normal", "spacious"],
      })
    }
  })
  test("field-group blocks do not get spacing", () => {
    for (const name of ["image", "author", "gallery", "seo"]) {
      expect(byName(name)?.schema.spacing).toBeUndefined()
    }
  })
})
