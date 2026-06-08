import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { ChannelMirror } from "../../src/components/continuum/ChannelMirror"

const blocks = [{ type: "paragraph", children: [{ type: "text", value: "Hello world" }] }]

describe("ChannelMirror", () => {
  test("renders web/email/rss tabs and the live web render", () => {
    const html = renderToString(
      <ChannelMirror blocks={blocks} title="Launch week" byline="Dik Rana" />,
    )
    expect(html).toContain("Web")
    expect(html).toContain("Email")
    expect(html).toContain("RSS")
    expect(html).toContain("Hello world")
    expect(html).toContain("Launch week")
  })

  test("renders real email HTML in an iframe without the approximation note", () => {
    const html = renderToString(
      <ChannelMirror
        apiBase=""
        blocks={blocks}
        title="Launch week"
        byline="Dik Rana"
        initialChannel="email"
        initialEmailHtml="<html><body>RENDERED</body></html>"
      />,
    )

    expect(html).toContain("<iframe")
    expect(html).toContain("RENDERED")
    expect(html).not.toContain("Email is an approximation")
  })
})
