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
