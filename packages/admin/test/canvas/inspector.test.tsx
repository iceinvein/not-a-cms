// packages/admin/test/canvas/inspector.test.tsx
import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { Inspector, CUSTOM_BLOCK_INSPECTORS } from "../../src/components/continuum/canvas/Inspector"
import { blockSpecs } from "../../src/components/continuum/blocks/specs"

// Minimal editor stub: only what Inspector reads/writes.
function makeEditor(attrsByPos: Record<number, { name: string; attrs: Record<string, unknown> }>) {
  return {
    state: {
      doc: {
        nodeAt: (pos: number) => {
          const entry = attrsByPos[pos]
          if (!entry) return null
          return { type: { name: entry.name }, attrs: entry.attrs }
        },
      },
    },
    chain: () => ({ command: () => ({ run: () => true }) }),
  } as any
}

describe("Inspector", () => {
  test("renders non-inline fields for the selected hero and hides inline text", () => {
    const editor = makeEditor({
      6: { name: "hero", attrs: { eyebrow: "Beta", headline: "Hi", subheadline: "", align: "center", backgroundImage: "", overlay: true } },
    })
    const html = renderToString(<Inspector editor={editor} selected={{ pos: 6, name: "hero" }} apiBase="" />)
    expect(html).toContain("Align")
    expect(html).toContain("Overlay")
    expect(html).not.toContain("Headline")
    expect(html).not.toContain("Eyebrow")
  })

  test("renders an item-structure control for featureGrid's items array", () => {
    const editor = makeEditor({
      2: { name: "featureGrid", attrs: { items: [{ icon: "", title: "A", text: "" }], columns: 3 } },
    })
    const html = renderToString(<Inspector editor={editor} selected={{ pos: 2, name: "featureGrid" }} apiBase="" />)
    expect(html).toContain("Columns")
    expect(html).toContain("Items")
    expect(html).toContain("Add item")
  })

  test("renders an empty-state hint when nothing is selected", () => {
    const editor = makeEditor({})
    const html = renderToString(<Inspector editor={editor} selected={null} apiBase="" />)
    expect(html).toContain("Select a section")
  })
})

describe("Inspector custom block panels", () => {
  test("exports a custom block-inspector registry object", () => {
    expect(typeof CUSTOM_BLOCK_INSPECTORS).toBe("object")
  })
})

describe("Inspector media + custom arrays", () => {
  test("specs declare mediaFields for picker-backed URL fields", () => {
    const hero = blockSpecs.find((s) => s.name === "hero")
    expect(hero?.mediaFields).toEqual(["backgroundImage"])
    const split = blockSpecs.find((s) => s.name === "splitMedia")
    expect(split?.mediaFields).toEqual(["media"])
    const testimonial = blockSpecs.find((s) => s.name === "testimonial")
    expect(testimonial?.mediaFields).toEqual(["avatar"])
  })

  test("renders a Vault picker control for a mediaField", () => {
    const editor = makeEditor({
      3: { name: "splitMedia", attrs: { media: "", side: "left", heading: "", body: "", ctaLabel: "", ctaUrl: "" } },
    })
    const html = renderToString(<Inspector editor={editor} selected={{ pos: 3, name: "splitMedia" }} apiBase="" />)
    expect(html).toContain("cn-media-pick")
  })
})
