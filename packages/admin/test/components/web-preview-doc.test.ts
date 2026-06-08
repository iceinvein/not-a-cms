import { describe, expect, test } from "bun:test"
import { buildWebPreviewDoc } from "../../src/components/continuum/ChannelMirror"

describe("buildWebPreviewDoc (F-012 preview fidelity)", () => {
  const base = {
    variables: ":root { --accent: #c2410c; }",
    fontImport: "https://fonts.example/x.css",
  }

  test("embeds the theme vars, font link, brand CSS, and the body", () => {
    const doc = buildWebPreviewDoc({ ...base, body: "<p>Hi</p>", title: "About" })
    expect(doc).toContain("--accent: #c2410c")
    expect(doc).toContain('href="https://fonts.example/x.css"')
    // brand CSS is inlined (a section-block selector proves it)
    expect(doc).toContain(".nac-hero")
    expect(doc).toContain("<p>Hi</p>")
    expect(doc).toContain("About")
  })

  test("shows the page title unless the body leads with a hero", () => {
    const withTitle = buildWebPreviewDoc({ ...base, body: "<p>x</p>", title: "Pricing" })
    expect(withTitle).toContain('<h1 class="nac-preview-title">Pricing</h1>')

    const heroLed = buildWebPreviewDoc({
      ...base,
      body: '<section class="nac-band nac-hero">...</section>',
      title: "Pricing",
      leadsWithHero: true,
    })
    expect(heroLed).not.toContain("<h1")
  })

  test("escapes the title and omits the font link when there is no import", () => {
    const doc = buildWebPreviewDoc({ variables: ":root {}", body: "", title: "<script>x</script>" })
    expect(doc).not.toContain("<script>x")
    expect(doc).toContain("&lt;script&gt;")
    expect(doc).not.toContain('<link rel="stylesheet"')
  })
})
