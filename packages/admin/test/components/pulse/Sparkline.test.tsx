import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { Sparkline } from "../../../src/components/pulse/Sparkline"

describe("Sparkline", () => {
  test("maps points to a normalized polyline and shows the delta", () => {
    const html = renderToString(<Sparkline points={[1, 2, 3]} delta="+18 today" />)
    expect(html).toContain('points="0,18 27,9 54,0"')
    expect(html).toContain("+18 today")
    expect(html).toContain('aria-hidden="true"')
  })

  test("single point renders without division by zero", () => {
    const html = renderToString(<Sparkline points={[42]} />)
    expect(html).toContain('points="0,18"')
  })

  test("renders nothing breakable for an empty series", () => {
    const html = renderToString(<Sparkline points={[]} />)
    expect(html).toContain("<svg")
    expect(html).not.toContain("pulse-delta")
  })
})
