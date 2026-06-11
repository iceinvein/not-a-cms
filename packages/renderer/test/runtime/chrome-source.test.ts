import { describe, expect, test } from "bun:test"

const read = (p: string) => Bun.file(p).text()

describe("Astro chrome components delegate to renderSiteChrome", () => {
  test("Header.astro renders renderSiteChrome().header via set:html and keeps its toggle script", async () => {
    const src = await read("src/defaults/components/Header.astro")
    expect(src).toContain("renderSiteChrome")
    expect(src).toContain("set:html")
    expect(src).toContain("<script") // public-site hamburger toggle retained
    expect(src).not.toContain("max-w-4xl") // layout no longer via Tailwind utilities
  })
  test("Footer.astro renders renderSiteChrome().footer via set:html", async () => {
    const src = await read("src/defaults/components/Footer.astro")
    expect(src).toContain("renderSiteChrome")
    expect(src).toContain("set:html")
    expect(src).not.toContain("max-w-4xl")
  })
})
