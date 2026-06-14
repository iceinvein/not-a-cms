import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { StatusSignal } from "../../../src/components/pulse/StatusSignal"

const NOW = Date.parse("2026-06-14T12:00:00.000Z")

describe("StatusSignal", () => {
  test("scheduled shows a live countdown", () => {
    const html = renderToString(
      <StatusSignal kind="scheduled" at="2026-06-14T14:14:09.000Z" now={NOW} />,
    )
    expect(html).toContain("live in 02:14:09")
    expect(html).toContain("pulse-signal-scheduled")
  })

  test("expiring shows days remaining", () => {
    const html = renderToString(
      <StatusSignal kind="expiring" at="2026-06-17T12:00:00.000Z" now={NOW} />,
    )
    expect(html).toContain("expires 3d")
  })

  test("expiring with a past timestamp clamps to 0d", () => {
    const html = renderToString(
      <StatusSignal kind="expiring" at="2026-06-13T12:00:00.000Z" now={NOW} />,
    )
    expect(html).toContain("expires 0d")
  })

  test("in_review shows its label and gets its signal class", () => {
    const html = renderToString(<StatusSignal kind="in_review" />)
    expect(html).toContain("in review")
    expect(html).toContain("pulse-signal-in_review")
  })
})
