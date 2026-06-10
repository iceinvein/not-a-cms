// packages/admin/test/canvas/breadcrumb.test.tsx
import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { Breadcrumb } from "../../src/components/continuum/canvas/Breadcrumb"

function mockEditor(nodes: Array<{ name: string; size?: number }>, from: number) {
  return {
    state: {
      doc: {
        forEach(fn: (node: any, offset: number, index: number) => void) {
          let offset = 0
          nodes.forEach((n, i) => {
            const size = n.size ?? 1
            fn({ type: { name: n.name }, attrs: {}, nodeSize: size }, offset, i)
            offset += size
          })
        },
      },
      selection: { from },
    },
  } as never
}

describe("Breadcrumb", () => {
  test("shows just the document root with no editor", () => {
    const html = renderToString(<Breadcrumb editor={null} />)
    expect(html).toContain("cn-breadcrumb")
    expect(html).toContain("Document")
  })
  test("appends the selected block's label", () => {
    const html = renderToString(<Breadcrumb editor={mockEditor([{ name: "hero", size: 1 }], 0)} />)
    expect(html).toContain("Document")
    expect(html).toContain("Hero")
  })
  test("shows only the root when the selection is outside every block", () => {
    const html = renderToString(<Breadcrumb editor={mockEditor([{ name: "hero", size: 1 }], 99)} />)
    expect(html).toContain("Document")
    expect(html).not.toContain("Hero")
  })
})
