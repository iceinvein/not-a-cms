// packages/admin/test/canvas/living/cta-living.test.tsx
import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { CtaLiving } from "../../../src/components/continuum/canvas/living/CtaLiving"
import { expectBlockParity } from "../parity"

const full = { label: "Buy now", url: "/pricing", variant: "secondary" }

describe("CtaLiving", () => {
  test("matches the production renderer", () => {
    expectBlockParity(<CtaLiving attrs={full} editable={false} setText={() => {}} />, "cta", full)
  })

  test("matches the renderer's default label when empty", () => {
    const empty = { label: "", url: "/x", variant: "primary" }
    expectBlockParity(<CtaLiving attrs={empty} editable={false} setText={() => {}} />, "cta", empty)
  })

  test("editable mode makes the label a contenteditable hole", () => {
    const html = renderToString(<CtaLiving attrs={full} editable setText={() => {}} />)
    expect(html.toLowerCase()).toContain("contenteditable") // React 19 serializes the prop as contentEditable="true"
    expect(html).toContain("Buy now")
    expect(html).toContain('class="nac-cta-btn"')
  })
})
