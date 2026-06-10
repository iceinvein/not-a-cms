// packages/admin/test/canvas/selection.test.tsx
import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { CanvasSelectionContext, useCanvasSelection } from "../../src/components/continuum/canvas/selection"

function Probe() {
  const { selected } = useCanvasSelection()
  return <span>{selected ? `${selected.name}@${selected.pos}` : "none"}</span>
}

describe("CanvasSelectionContext", () => {
  test("defaults to no selection", () => {
    expect(renderToString(<Probe />)).toContain("none")
  })

  test("exposes the provided selection", () => {
    const html = renderToString(
      <CanvasSelectionContext.Provider
        value={{ selected: { pos: 4, name: "hero" }, select: () => {}, clear: () => {} }}
      >
        <Probe />
      </CanvasSelectionContext.Provider>,
    )
    expect(html).toContain("hero@4")
  })
})
