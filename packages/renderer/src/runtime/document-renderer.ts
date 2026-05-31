import { portableTextToHtml } from "./channel"
import { renderPageLayout, escapeHtml, resolveComponentRenderers, type ComponentRendererMap, type ComponentRendererOverrides } from "./page-renderer"
import type { ContentItem } from "./content-fetcher"

export const defaultRenderers: ComponentRendererMap = {
  hero: (props) =>
    `<div class="hero" style="text-align:center;padding:4rem 2rem"><h1 style="font-size:2.5rem;font-weight:bold;margin-bottom:0.5rem">${escapeHtml(String(props.headline ?? ""))}</h1><p style="font-size:1.25rem;color:#666">${escapeHtml(String(props.subheadline ?? ""))}</p></div>`,
  text_block: (props) =>
    `<div class="text-block" style="text-align:${escapeHtml(String(props.alignment ?? "left"))};padding:1rem 0">${escapeHtml(String(props.content ?? ""))}</div>`,
  image_block: (props) =>
    `<figure style="padding:1rem 0">${props.src ? `<img src="${escapeHtml(String(props.src))}" alt="${escapeHtml(String(props.alt ?? ""))}" style="max-width:100%;height:auto" />` : ""}<figcaption style="font-size:0.875rem;color:#666;margin-top:0.5rem">${escapeHtml(String(props.caption ?? ""))}</figcaption></figure>`,
  cta: (props) =>
    `<div style="padding:1rem 0"><a href="${escapeHtml(String(props.url ?? "#"))}" class="cta cta-${escapeHtml(String(props.variant ?? "primary"))}" style="display:inline-block;padding:0.75rem 1.5rem;border-radius:0.375rem;font-weight:600;text-decoration:none;${props.variant === "outline" ? "border:2px solid currentColor;color:#333" : "background:#2563eb;color:#fff"}">${escapeHtml(String(props.label ?? "Click here"))}</a></div>`,
}

export type RenderedDocument = {
  isPageLayout: boolean
  html: string
}

export function renderDocumentContent(document: ContentItem, renderers: ComponentRendererOverrides = {}): RenderedDocument {
  const componentRenderers = resolveComponentRenderers(defaultRenderers, renderers)
  if (document.layout) {
    try {
      const layout = typeof document.layout === "string" ? JSON.parse(document.layout) : document.layout
      if (layout && layout._type === "page") {
        return { isPageLayout: true, html: renderPageLayout(layout, componentRenderers) }
      }
    } catch {
      // Fall through to body rendering.
    }
  }

  if (document.body) {
    try {
      const blocks = typeof document.body === "string" ? JSON.parse(document.body) : document.body
      return { isPageLayout: false, html: portableTextToHtml(blocks) }
    } catch {
      return { isPageLayout: false, html: "<p>Error rendering content.</p>" }
    }
  }

  return { isPageLayout: false, html: "" }
}
