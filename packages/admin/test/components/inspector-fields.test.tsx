import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { FieldRow } from "../../src/components/continuum/InspectorFields"

describe("FieldRow (extracted)", () => {
  test("renders a humanized label and a select control for a select field", () => {
    const html = renderToString(
      <FieldRow
        fieldName="align"
        def={{ type: "select", options: ["center", "left"] }}
        value="center"
        apiBase=""
        onChange={() => {}}
      />,
    )
    expect(html).toContain("Align")
    expect(html).toContain("Center")
  })

  test("renders a number input for a number field", () => {
    const html = renderToString(
      <FieldRow
        fieldName="columns"
        def={{ type: "number" }}
        value={3}
        apiBase=""
        onChange={() => {}}
      />,
    )
    expect(html).toContain('type="number"')
    expect(html).toContain('value="3"')
  })
})
