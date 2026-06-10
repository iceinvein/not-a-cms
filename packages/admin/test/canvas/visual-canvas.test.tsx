import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { VisualCanvas } from "../../src/components/continuum/canvas/VisualCanvas"

describe("VisualCanvas", () => {
  test("renders the scoped canvas container", () => {
    const html = renderToString(
      <VisualCanvas
        content={[{ type: "paragraph", children: [{ type: "text", value: "Hi" }] }]}
        apiBase=""
      />,
    )
    expect(html).toContain("cn-visual")
    expect(html).toContain("cn-visual-page")
  })

  test("does not emit an unscoped :root variable block", () => {
    const html = renderToString(<VisualCanvas content={[]} apiBase="" />)
    expect(html).not.toContain(":root")
  })
})

describe("VisualCanvas inspector rail", () => {
  test("renders the inspector rail with its empty state", () => {
    const html = renderToString(<VisualCanvas content={[]} apiBase="" />)
    expect(html).toContain("cn-inspector")
    expect(html).toContain("Select a section")
  })
})

describe("VisualCanvas Phase 3A chrome", () => {
  test("renders the structure tree, breadcrumb, and overlay layer", () => {
    const html = renderToString(<VisualCanvas content={[]} apiBase="" />)
    expect(html).toContain("cn-tree")
    expect(html).toContain("cn-breadcrumb")
    expect(html).toContain("cn-overlay")
    expect(html).toContain("cn-visual-stage")
  })

  test("the structure tree starts empty until the editor mounts (SSR)", () => {
    const html = renderToString(<VisualCanvas content={[]} apiBase="" />)
    expect(html).toContain("No blocks yet")
  })
})
