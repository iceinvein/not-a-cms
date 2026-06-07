export type NavLink = { label: string; href: string; external?: boolean }
export type SiteNav = { links?: NavLink[]; cta?: { label: string; href: string } }
export type SiteFooter = {
  tagline?: string
  columns?: Array<{ heading: string; links: NavLink[] }>
  social?: NavLink[]
  legal?: string
}
export type SiteChrome = { siteName: string; nav: SiteNav | null; footer: SiteFooter | null }

/**
 * Map an /api/_site response (or null on fetch failure) to safe chrome values.
 * Falls back to "not-a-cms" when siteName is absent or empty, and null for nav/footer.
 */
export function resolveSiteChrome(
  apiSite: { siteName?: string | null; nav?: SiteNav | null; footer?: SiteFooter | null } | null,
): SiteChrome {
  return {
    siteName: apiSite?.siteName?.trim() ? apiSite.siteName : "not-a-cms",
    nav: apiSite?.nav ?? null,
    footer: apiSite?.footer ?? null,
  }
}
