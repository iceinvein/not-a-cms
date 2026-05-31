import React from "react"
import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { ChannelSettings } from "../../src/components/ChannelSettings"

describe("ChannelSettings", () => {
  test("renders RSS and email channel controls", () => {
    const html = renderToString(
      <ChannelSettings
        apiBase="https://cms.example.test"
        initialSettings={{
          "channel.rss.title": "Editorial Feed",
          "channel.rss.description": "Latest stories",
          "channel.rss.language": "en-AU",
          "channel.rss.collection": "blog_post",
          "channel.rss.itemPath": "/blog/:slug",
          "channel.email.title": "Editorial Email",
          "channel.email.preheader": "Weekly highlights",
          "channel.email.footerText": "You are receiving editorial updates.",
        }}
      />,
    )

    expect(html).toContain("Channel Settings")
    expect(html).toContain("RSS")
    expect(html).toContain("Editorial Feed")
    expect(html).toContain("Latest stories")
    expect(html).toContain("/blog/:slug")
    expect(html).toContain("Email")
    expect(html).toContain("Editorial Email")
    expect(html).toContain("Weekly highlights")
  })
})
