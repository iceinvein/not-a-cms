// packages/admin/test/canvas/structure-tree.test.tsx
import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { StructureTree } from "../../src/components/continuum/canvas/StructureTree"

/** A mock editor whose state.doc yields the given nodes and whose selection sits at `from`. */
function mockEditor(
  nodes: Array<{ name: string; attrs?: Record<string, unknown>; size?: number }>,
  from: number,
) {
  return {
    state: {
      doc: {
        forEach(fn: (node: any, offset: number, index: number) => void) {
          let offset = 0
          nodes.forEach((n, i) => {
            const size = n.size ?? 1
            fn({ type: { name: n.name }, attrs: n.attrs ?? {}, nodeSize: size }, offset, i)
            offset += size
          })
        },
      },
      selection: { from },
    },
  } as never
}

describe("StructureTree", () => {
  test("renders the empty state with no editor", () => {
    const html = renderToString(<StructureTree editor={null} />)
    expect(html).toContain("cn-tree")
    expect(html).toContain("No blocks yet")
  })

  test("renders one row per top-level block with its label and group", () => {
    const html = renderToString(
      <StructureTree
        editor={mockEditor(
          [
            { name: "hero", size: 1 },
            { name: "paragraph", size: 3 },
          ],
          0,
        )}
      />,
    )
    expect(html).toContain("Hero")
    expect(html).toContain("Paragraph")
    expect(html).toContain('data-pos="0"')
    expect(html).toContain('data-pos="1"')
    expect(html).toContain('data-group="sections"')
    expect(html).toContain('data-group="prose"')
  })

  test("marks the row containing the selection as active", () => {
    const html = renderToString(
      <StructureTree
        editor={mockEditor(
          [
            { name: "hero", size: 1 },
            { name: "paragraph", size: 3 },
          ],
          2,
        )}
      />,
    )
    expect(html).toMatch(/data-pos="1"[^>]*aria-current="true"/)
    expect(html).not.toMatch(/data-pos="0"[^>]*aria-current="true"/)
  })
})
