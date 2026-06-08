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

  test("isolates every preview in a script-disabled sandboxed iframe", () => {
    const web = renderToString(<ChannelMirror blocks={blocks} title="Launch week" />)
    expect(web).toContain("sandbox=")
    // an empty sandbox grants nothing, so embedded content can never run scripts
    expect(web).not.toContain("allow-scripts")

    const email = renderToString(
      <ChannelMirror
        blocks={blocks}
        title="Launch week"
        initialChannel="email"
        initialEmailHtml="<html><body>RENDERED</body></html>"
      />,
    )
    expect(email).toContain("sandbox=")
    expect(email).not.toContain("allow-scripts")
  })

  test("renders the RSS channel in a sandboxed iframe rather than the live admin DOM", () => {
    const html = renderToString(
      <ChannelMirror blocks={blocks} title="Launch week" initialChannel="rss" />,
    )
    expect(html).toContain('title="RSS preview"')
    expect(html).toContain("sandbox=")
    expect(html).not.toContain("allow-scripts")
    // the rendered body travels inside the iframe's srcDoc, not as live markup
    expect(html).not.toContain("dangerouslySetInnerHTML")
    expect(html).toContain("Hello world")
  })
})
