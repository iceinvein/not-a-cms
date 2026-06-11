import { describe, expect, test } from "bun:test"
import { renderSiteChrome } from "../../src/runtime/site-chrome-html"

describe("renderSiteChrome header", () => {
  test("renders the wordmark, nav links, CTA, and mobile nav when nav is present", () => {
    const { header } = renderSiteChrome({
      siteName: "Atelier",
      nav: { links: [{ label: "Work", href: "/work" }], cta: { label: "Contact", href: "/contact" } },
      footer: null,
    })
    expect(header).toContain('<header class="nac-header">')
    expect(header).toContain('<div class="nac-header-inner">')
    expect(header).toContain('class="nac-wordmark"')
    expect(header).toContain(">Atelier<")
    expect(header).toContain('<nav class="nac-nav" id="nac-desktop-nav">')
    expect(header).toContain('class="nac-nav-link" href="/work"')
    expect(header).toContain('class="nac-cta-btn" data-variant="primary" href="/contact"')
    expect(header).toContain('class="nac-nav-toggle"')
    expect(header).toContain('<nav class="nac-mobile-nav" id="nac-mobile-nav"')
    expect(header).not.toContain("<script")
    expect(header).not.toContain("max-w-4xl")
  })

  test("renders a bare wordmark header when nav is null", () => {
    const { header } = renderSiteChrome({ siteName: "not-a-cms", nav: null, footer: null })
    expect(header).toContain(">not-a-cms<")
    expect(header).not.toContain("nac-nav-toggle")
    expect(header).not.toContain("nac-mobile-nav")
  })

  test("escapes text and sanitizes hrefs", () => {
    const { header } = renderSiteChrome({
      siteName: "<x>",
      nav: { links: [{ label: "Bad", href: "javascript:alert(1)" }] },
      footer: null,
    })
    expect(header).toContain("&lt;x&gt;")
    expect(header).not.toContain("javascript:")
    expect(header).toContain('href="#"')
  })

  test("neutralizes a javascript: CTA href to #", () => {
    const { header } = renderSiteChrome({
      siteName: "S",
      nav: { links: [], cta: { label: "Go", href: "javascript:alert(1)" } },
      footer: null,
    })
    expect(header).not.toContain("javascript:")
    expect(header).toContain('href="#"')
    expect(header).toContain(">Go<")
  })

  test("HTML-encodes & in hrefs", () => {
    const { header } = renderSiteChrome({
      siteName: "S",
      nav: { links: [{ label: "Search", href: "/r?q=a&b=2" }] },
      footer: null,
    })
    expect(header).toContain('href="/r?q=a&amp;b=2"')
    expect(header).not.toContain('href="/r?q=a&b=2"')
  })

  test("adds target/rel for external links", () => {
    const { header } = renderSiteChrome({
      siteName: "S",
      nav: { links: [{ label: "Ext", href: "https://example.com", external: true }] },
      footer: null,
    })
    expect(header).toContain('target="_blank"')
    expect(header).toContain('rel="noopener noreferrer"')
  })
})

describe("renderSiteChrome footer", () => {
  test("renders tagline, columns, social, and legal", () => {
    const { footer } = renderSiteChrome({
      siteName: "Atelier",
      nav: null,
      footer: {
        tagline: "Built well",
        columns: [{ heading: "Company", links: [{ label: "About", href: "/about" }] }],
        social: [{ label: "GitHub", href: "https://github.com/x" }],
        legal: "© 2026 Atelier",
      },
    })
    expect(footer).toContain('<footer class="nac-footer">')
    expect(footer).toContain('<div class="nac-footer-inner">')
    expect(footer).toContain('class="nac-footer-tagline">Built well<')
    expect(footer).toContain('<div class="nac-footer-columns">')
    expect(footer).toContain('class="nac-footer-col-heading">Company<')
    expect(footer).toContain('class="nac-footer-link" href="/about"')
    expect(footer).toContain('class="nac-footer-social"')
    expect(footer).toContain('class="nac-footer-legal">© 2026 Atelier<')
  })

  test("renders a minimal footer with a default legal line when footer is null", () => {
    const year = new Date().getFullYear()
    const { footer } = renderSiteChrome({ siteName: "not-a-cms", nav: null, footer: null })
    expect(footer).toContain("nac-footer-inner--minimal")
    expect(footer).toContain(`© ${year} not-a-cms`)
  })
})
