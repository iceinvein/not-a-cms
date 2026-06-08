import { describe, expect, test } from "bun:test"
import { buildRssPreviewDoc } from "../../src/components/continuum/ChannelMirror"

describe("buildRssPreviewDoc (sandboxed RSS preview)", () => {
  test("wraps the rendered body in a self-contained reader document", () => {
    const doc = buildRssPreviewDoc({
      body: "<p>Hello feed</p>",
      title: "Launch week",
      byline: "Dik Rana",
    })
    expect(doc).toContain("<!doctype html>")
    expect(doc).toContain("<p>Hello feed</p>")
    expect(doc).toContain("Launch week")
    expect(doc).toContain("Dik Rana")
    // The iframe is sandboxed, so the reader styling must be inlined (it cannot
    // reach the admin stylesheet).
    expect(doc).toContain(".nac-rss")
  })

  test("escapes the title and byline so they cannot inject markup", () => {
    const doc = buildRssPreviewDoc({
      body: "<p>x</p>",
      title: "<script>alert(1)</script>",
      byline: "<img src=x onerror=alert(1)>",
    })
    expect(doc).not.toContain("<script>alert(1)")
    expect(doc).toContain("&lt;script&gt;")
    expect(doc).not.toContain("<img src=x onerror")
  })

  test("omits the byline element when none is given", () => {
    const doc = buildRssPreviewDoc({ body: "<p>x</p>", title: "T" })
    expect(doc).not.toContain('<p class="nac-rss-byline">')
  })
})
