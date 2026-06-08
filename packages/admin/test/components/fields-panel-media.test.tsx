import { describe, expect, test } from "bun:test"
import React from "react"
import { renderToString } from "react-dom/server"
import { FieldsPanel } from "../../src/components/continuum/FieldsPanel"

describe("FieldsPanel media field (F-014)", () => {
  test("renders a Vault picker and upload affordance, not just a bare 'Asset id' box", () => {
    const html = renderToString(
      <FieldsPanel
        fields={{ coverImage: { type: "media" } }}
        data={{}}
        updateField={() => {}}
        apiBase=""
      />,
    )
    expect(html).toContain("Choose from Vault")
    expect(html).toContain("Upload")
    // The old bare-text-input placeholder must be gone.
    expect(html).not.toContain("Asset id")
  })

  test("shows a preview and a remove control when a value is set", () => {
    const html = renderToString(
      <FieldsPanel
        fields={{ coverImage: { type: "media" } }}
        data={{ coverImage: "abc-123" }}
        updateField={() => {}}
        apiBase="http://localhost:4321"
      />,
    )
    expect(html).toContain("/api/media/abc-123/file")
    expect(html).toContain("Remove image")
    expect(html).toContain("Replace")
  })
})
