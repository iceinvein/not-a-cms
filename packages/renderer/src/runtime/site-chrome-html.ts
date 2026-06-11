import { sanitizeUrl } from "./portable-text-html"
import type { NavLink, SiteChrome } from "./site-chrome"

export type { NavLink, SiteChrome, SiteFooter, SiteNav } from "./site-chrome"
export { resolveSiteChrome } from "./site-chrome"

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function linkAttrs(link: NavLink): string {
  return link.external ? ` target="_blank" rel="noopener noreferrer"` : ""
}

function navLink(link: NavLink, cls: string): string {
  return `<a class="${cls}" href="${escapeHtml(sanitizeUrl(link.href))}"${linkAttrs(link)}>${escapeHtml(link.label)}</a>`
}

function renderHeader(chrome: SiteChrome): string {
  const wordmark = `<a href="/" class="nac-wordmark">${escapeHtml(chrome.siteName)}</a>`
  const nav = chrome.nav
  const hasNav = !!(nav?.links?.length || nav?.cta)
  if (!hasNav) {
    return `<header class="nac-header"><div class="nac-header-inner">${wordmark}</div></header>`
  }
  const desktopLinks = (nav?.links ?? []).map((l) => navLink(l, "nac-nav-link")).join("")
  const desktopCta = nav?.cta
    ? `<a class="nac-cta-btn" data-variant="primary" href="${escapeHtml(sanitizeUrl(nav.cta.href))}">${escapeHtml(nav.cta.label)}</a>`
    : ""
  const mobileLinks = (nav?.links ?? []).map((l) => navLink(l, "nac-mobile-nav-link")).join("")
  const mobileCta = nav?.cta
    ? `<a class="nac-cta-btn nac-mobile-cta" data-variant="primary" href="${escapeHtml(sanitizeUrl(nav.cta.href))}">${escapeHtml(nav.cta.label)}</a>`
    : ""
  return (
    `<header class="nac-header"><div class="nac-header-inner">${wordmark}` +
    `<nav class="nac-nav" id="nac-desktop-nav">${desktopLinks}${desktopCta}</nav>` +
    `<button class="nac-nav-toggle" aria-label="Menu" aria-expanded="false" aria-controls="nac-mobile-nav" type="button">` +
    `<span class="nac-hamburger-bar"></span><span class="nac-hamburger-bar"></span><span class="nac-hamburger-bar"></span>` +
    `</button>` +
    `<nav class="nac-mobile-nav" id="nac-mobile-nav" aria-label="Mobile navigation">${mobileLinks}${mobileCta}</nav>` +
    `</div></header>`
  )
}

function renderFooter(chrome: SiteChrome): string {
  const year = new Date().getFullYear()
  const footer = chrome.footer
  const legalLine = footer?.legal ?? `© ${year} ${chrome.siteName}`
  if (!footer) {
    return `<footer class="nac-footer"><div class="nac-footer-inner nac-footer-inner--minimal"><p>${escapeHtml(legalLine)}</p></div></footer>`
  }
  const tagline = footer.tagline
    ? `<p class="nac-footer-tagline">${escapeHtml(footer.tagline)}</p>`
    : ""
  const columns =
    footer.columns?.length
      ? `<div class="nac-footer-columns">${footer.columns
          .map(
            (col) =>
              `<div class="nac-footer-col"><p class="nac-footer-col-heading">${escapeHtml(col.heading)}</p>` +
              `<ul class="nac-footer-col-list">${col.links
                .map((l) => `<li>${navLink(l, "nac-footer-link")}</li>`)
                .join("")}</ul></div>`,
          )
          .join("")}</div>`
      : ""
  const social =
    footer.social?.length
      ? `<div class="nac-footer-social">${footer.social
          .map(
            (l) =>
              `<a class="nac-footer-social-link" href="${escapeHtml(sanitizeUrl(l.href))}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)}</a>`,
          )
          .join("")}</div>`
      : ""
  return (
    `<footer class="nac-footer"><div class="nac-footer-inner">` +
    `${tagline}${columns}${social}` +
    `<p class="nac-footer-legal">${escapeHtml(legalLine)}</p>` +
    `</div></footer>`
  )
}

/**
 * Render the site header and footer as HTML strings from resolved SiteChrome.
 * Single source of truth: the public Astro Header/Footer consume this via set:html,
 * and the admin Visual canvas injects the same strings. Emits only nac-* markup
 * (styled by brandCss); contains no inline <script>.
 */
export function renderSiteChrome(chrome: SiteChrome): { header: string; footer: string } {
  return { header: renderHeader(chrome), footer: renderFooter(chrome) }
}
