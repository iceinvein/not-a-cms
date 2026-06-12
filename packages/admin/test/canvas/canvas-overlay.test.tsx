// packages/admin/test/canvas/canvas-overlay.test.tsx
import { describe, expect, test } from "bun:test"
import { createRef } from "react"
import { renderToString } from "react-dom/server"
import { CanvasOverlay } from "../../src/components/continuum/canvas/CanvasOverlay"

describe("CanvasOverlay", () => {
  test("renders the pointer-events-none overlay layer (no boxes under SSR)", () => {
    const html = renderToString(
      <CanvasOverlay editor={null} containerRef={createRef<HTMLDivElement>()} />,
    )
    expect(html).toContain("cn-overlay")
    // Effects do not run under SSR, so no boxes are present yet.
    expect(html).not.toContain("cn-overlay-box")
  })

  test("accepts a cursors prop and stays crash-free under SSR (no boxes computed yet)", () => {
    const cursors = [{ clientId: "a", user: { name: "Ada", color: "#3b82f6" }, anchor: 1, head: 1 }]
    let html = ""
    expect(() => {
      html = renderToString(
        <CanvasOverlay
          editor={null}
          containerRef={createRef<HTMLDivElement>()}
          cursors={cursors}
        />,
      )
    }).not.toThrow()
    expect(html).toContain("cn-overlay")
    expect(html).not.toContain("cn-overlay-remote")
  })
})
