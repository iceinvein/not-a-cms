import { describe, expect, test } from "bun:test"
import { resolveSiteChrome } from "../../src/runtime/site-chrome"

describe("resolveSiteChrome", () => {
  test("returns API values when all fields are present", () => {
    const nav = { links: [{ label: "Home", href: "/" }], cta: { label: "Sign up", href: "/signup" } }
    const footer = {
      tagline: "Tagline text.",
      columns: [{ heading: "Product", links: [{ label: "Pricing", href: "/pricing" }] }],
      social: [{ label: "GitHub", href: "https://github.com" }],
      legal: "© 2026 Acme",
    }
    const result = resolveSiteChrome({ siteName: "Acme CMS", nav, footer })
    expect(result.siteName).toBe("Acme CMS")
    expect(result.nav).toEqual(nav)
    expect(result.footer).toEqual(footer)
  })

  test("falls back to not-a-cms siteName when API returns null", () => {
    const result = resolveSiteChrome(null)
    expect(result.siteName).toBe("not-a-cms")
    expect(result.nav).toBeNull()
    expect(result.footer).toBeNull()
  })

  test("falls back to not-a-cms siteName when siteName is an empty string", () => {
    const result = resolveSiteChrome({ siteName: "" })
    expect(result.siteName).toBe("not-a-cms")
  })

  test("falls back to not-a-cms siteName when siteName is whitespace only", () => {
    const result = resolveSiteChrome({ siteName: "   " })
    expect(result.siteName).toBe("not-a-cms")
  })

  test("falls back to not-a-cms siteName when siteName is null", () => {
    const result = resolveSiteChrome({ siteName: null })
    expect(result.siteName).toBe("not-a-cms")
  })

  test("returns null nav and footer when absent from API response", () => {
    const result = resolveSiteChrome({ siteName: "My Site" })
    expect(result.siteName).toBe("My Site")
    expect(result.nav).toBeNull()
    expect(result.footer).toBeNull()
  })

  test("returns null nav when API returns null for nav", () => {
    const result = resolveSiteChrome({ siteName: "My Site", nav: null })
    expect(result.nav).toBeNull()
  })

  test("returns partial nav with links only", () => {
    const nav = { links: [{ label: "About", href: "/about" }] }
    const result = resolveSiteChrome({ siteName: "My Site", nav })
    expect(result.nav).toEqual(nav)
  })

  test("returns partial nav with cta only", () => {
    const nav = { cta: { label: "Get started", href: "/start" } }
    const result = resolveSiteChrome({ siteName: "My Site", nav })
    expect(result.nav).toEqual(nav)
  })
})
