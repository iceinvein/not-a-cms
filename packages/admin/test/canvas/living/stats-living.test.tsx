import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { StatsLiving } from "../../../src/components/continuum/canvas/living/StatsLiving"
import { expectBlockParity } from "../parity"

const full = {
  columns: 4,
  items: [
    { value: "10k+", label: "Users" },
    { value: "99.9%", label: "Uptime" },
  ],
}

describe("StatsLiving", () => {
  test("matches the production renderer", () => {
    expectBlockParity(
      <StatsLiving attrs={full} editable={false} setItems={() => {}} />,
      "stats",
      full,
    )
  })

  test("matches the production renderer with non-default spacing", () => {
    const spacious = { ...full, spacing: "compact" }
    expectBlockParity(
      <StatsLiving attrs={spacious} editable={false} setItems={() => {}} />,
      "stats",
      spacious,
    )
  })

  test("editable mode renders contenteditable holes per stat", () => {
    const html = renderToString(<StatsLiving attrs={full} editable setItems={() => {}} />)
    expect(html.toLowerCase()).toContain("contenteditable") // React 19 serializes the prop as contentEditable="true"
    expect(html).toContain("10k+")
    expect(html).toContain('class="nac-stat-value"')
  })
})
