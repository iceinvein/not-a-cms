import React from "react"
import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { ChannelMirror } from "../../src/components/continuum/ChannelMirror"

const blocks = [{ type: "paragraph", children: [{ type: "text", value: "Hello world" }] }]

describe("ChannelMirror", () => {
  test("renders web/email/rss tabs and the live web render", () => {
    const html = renderToString(<ChannelMirror blocks={blocks} title="Launch week" byline="Dik Rana" />)
    expect(html).toContain("Web")
    expect(html).toContain("Email")
    expect(html).toContain("RSS")
    expect(html).toContain("Hello world")
    expect(html).toContain("Launch week")
  })
})
