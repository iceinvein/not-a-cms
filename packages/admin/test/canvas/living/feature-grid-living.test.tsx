// packages/admin/test/canvas/living/feature-grid-living.test.tsx
import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { FeatureGridLiving } from "../../../src/components/continuum/canvas/living/FeatureGridLiving"
import { expectBlockParity } from "../parity"

const full = {
  columns: 3,
  items: [
    { icon: "⚡", title: "Fast", text: "Very fast" },
    { icon: "🔒", title: "Secure", text: "Locked down" },
  ],
}

describe("FeatureGridLiving", () => {
  test("matches the production renderer", () => {
    expectBlockParity(
      <FeatureGridLiving attrs={full} editable={false} setItems={() => {}} />,
      "featureGrid",
      full,
    )
  })

  test("editable mode renders a contenteditable hole per card field", () => {
    const html = renderToString(<FeatureGridLiving attrs={full} editable setItems={() => {}} />)
    expect(html.toLowerCase()).toContain("contenteditable") // React 19 serializes the prop as contentEditable="true"
    expect(html).toContain("Fast")
    expect(html).toContain("Secure")
    expect(html).toContain('class="nac-feature-title"')
  })
})
