import { describe, expect, test } from "bun:test"
import { renderPortableText } from "../../src/runtime/portable-text-html"

describe("section blocks (F-012)", () => {
  test("renders a hero with eyebrow, headline, subheadline and alignment", () => {
    const html = renderPortableText([
      { type: "hero", eyebrow: "New", headline: "Ship faster", subheadline: "The CMS for 2026", align: "left" },
    ])
    expect(html).toContain("nac-band")
    expect(html).toContain("nac-hero")
    expect(html).toContain("nac-container")
    expect(html).toContain('data-align="left"')
    expect(html).toContain("nac-hero-eyebrow")
    expect(html).toContain("Ship faster")
    expect(html).toContain("The CMS for 2026")
  })

  test("defaults hero alignment to center", () => {
    const html = renderPortableText([{ type: "hero", headline: "Hi" }])
    expect(html).toContain('data-align="center"')
  })

  test("renders a CTA button with a safe href and variant", () => {
    const html = renderPortableText([{ type: "cta", label: "Get started", url: "/signup", variant: "primary" }])
    expect(html).toContain('class="nac-cta-btn"')
    expect(html).toContain('data-variant="primary"')
    expect(html).toContain('href="/signup"')
    expect(html).toContain("Get started")
  })

  test("CTA sanitizes dangerous urls", () => {
    const html = renderPortableText([{ type: "cta", label: "x", url: "javascript:alert(1)" }])
    expect(html).not.toContain("javascript:")
    expect(html).toContain('href="#"')
  })

  test("renders a feature grid of cards", () => {
    const html = renderPortableText([
      {
        type: "featureGrid",
        items: [
          { title: "Typed", text: "Real columns" },
          { title: "Fast", text: "Astro output" },
        ],
      },
    ])
    expect(html).toContain("nac-features")
    expect(html).toContain("nac-feature-grid")
    expect(html).toContain("Typed")
    expect(html).toContain("Real columns")
    expect(html).toContain("Fast")
    expect(html.match(/class="nac-feature"/g)?.length).toBe(2)
  })

  test("escapes hero content", () => {
    const html = renderPortableText([{ type: "hero", headline: "<script>x</script>" }])
    expect(html).not.toContain("<script>x")
    expect(html).toContain("&lt;script&gt;")
  })

  test("renders a hero background image with an overlay by default", () => {
    const html = renderPortableText([
      { type: "hero", headline: "Hi", backgroundImage: "https://cdn.example.com/bg.jpg" },
    ])
    expect(html).toContain('data-has-bg="true"')
    expect(html).toContain('data-overlay="true"')
    expect(html).toContain("background-image:url('https://cdn.example.com/bg.jpg')")
  })

  test("hero without a background image reports no bg", () => {
    const html = renderPortableText([{ type: "hero", headline: "Hi" }])
    expect(html).toContain('data-has-bg="false"')
  })

  test("hero overlay can be disabled", () => {
    const html = renderPortableText([
      { type: "hero", headline: "Hi", backgroundImage: "https://cdn.example.com/bg.jpg", overlay: false },
    ])
    expect(html).toContain('data-overlay="false"')
  })

  test("hero background rejects dangerous urls", () => {
    const html = renderPortableText([{ type: "hero", headline: "Hi", backgroundImage: "javascript:alert(1)" }])
    expect(html).not.toContain("javascript:")
    expect(html).toContain('data-has-bg="false"')
  })

  test("feature grid honors a column count and renders icons", () => {
    const html = renderPortableText([
      { type: "featureGrid", columns: 4, items: [{ icon: "⚡", title: "Fast", text: "x" }] },
    ])
    expect(html).toContain('data-columns="4"')
    expect(html).toContain("nac-feature-icon")
    expect(html).toContain("⚡")
  })

  test("feature grid defaults to 3 columns and clamps invalid counts", () => {
    expect(renderPortableText([{ type: "featureGrid", items: [] }])).toContain('data-columns="3"')
    expect(renderPortableText([{ type: "featureGrid", columns: 7, items: [] }])).toContain('data-columns="3"')
  })
})
