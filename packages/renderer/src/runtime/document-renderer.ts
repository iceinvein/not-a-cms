import { portableTextToHtml } from "./channel"
import type { ContentItem } from "./content-fetcher"

export type RenderedDocument = {
  html: string
  // True when the body's first block is a hero, so templates can suppress the
  // duplicate auto-rendered page title on a hero-led landing page.
  leadsWithHero: boolean
}

/**
 * Render a document's rich-text body to HTML. Marketing layout is expressed with
 * section blocks (hero/cta/featureGrid) inside the body, rendered by the Portable Text
 * serializer; there is no separate page-layout field.
 */
export function renderDocumentContent(document: ContentItem): RenderedDocument {
  if (document.body) {
    try {
      const blocks = typeof document.body === "string" ? JSON.parse(document.body) : document.body
      const leadsWithHero = Array.isArray(blocks) && blocks[0]?.type === "hero"
      return { html: portableTextToHtml(blocks), leadsWithHero }
    } catch {
      return { html: "<p>Error rendering content.</p>", leadsWithHero: false }
    }
  }

  return { html: "", leadsWithHero: false }
}
