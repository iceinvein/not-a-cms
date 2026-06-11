import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { LogoCloudLiving } from "../../../src/components/continuum/canvas/living/LogoCloudLiving"
import { expectBlockParity } from "../parity"

const full = {
  eyebrow: "Trusted by",
  logos: [
    { url: "/a.png", mediaId: "7", alt: "Acme" },
    { url: "/b.png", mediaId: "", alt: "Beta" },
  ],
}

describe("LogoCloudLiving", () => {
  test("matches the production renderer", () => {
    expectBlockParity(
      <LogoCloudLiving attrs={full} editable={false} setEyebrow={() => {}} />,
      "logoCloud",
      full,
    )
  })

  test("editable mode renders the eyebrow as a contenteditable hole", () => {
    const html = renderToString(<LogoCloudLiving attrs={full} editable setEyebrow={() => {}} />)
    expect(html.toLowerCase()).toContain("contenteditable") // React 19 serializes the prop as contentEditable="true"
    expect(html).toContain("Trusted by")
    expect(html).toContain('class="nac-logo"')
  })
})
