import { portableTextToHtml } from "./channel"
import { createContentFetcher, type ContentItem } from "./content-fetcher"

export type RenderedDocument = {
  html: string
  // True when the body's first block is a hero, so templates can suppress the
  // duplicate auto-rendered page title on a hero-led landing page.
  leadsWithHero: boolean
}

type RenderOpts = {
  apiBase: string
  fetch?: typeof fetch
}

/**
 * Render a document's rich-text body to HTML. Marketing layout is expressed with
 * section blocks (hero/cta/featureGrid) inside the body, rendered by the Portable Text
 * serializer; there is no separate page-layout field.
 *
 * For collectionList blocks, this function pre-fetches live published documents from
 * the configured collection before the synchronous serializer runs, then injects the
 * results as collectionData keyed by top-level block index.
 */
export async function renderDocumentContent(document: ContentItem, opts: RenderOpts): Promise<RenderedDocument> {
  if (document.body) {
    try {
      const blocks = typeof document.body === "string" ? JSON.parse(document.body) : document.body
      const leadsWithHero = Array.isArray(blocks) && blocks[0]?.type === "hero"

      // Pre-pass: resolve live data for collectionList blocks.
      const collectionData: Record<number, ContentItem[]> = {}
      if (Array.isArray(blocks)) {
        const fetcher = createContentFetcher({ apiBase: opts.apiBase, fetch: opts.fetch })
        await Promise.all(
          blocks.map(async (block: { type?: string; collection?: string; limit?: unknown; filterTag?: unknown }, i: number) => {
            if (block.type !== "collectionList") return
            try {
              const limit = Number(block.limit) || 3
              const collection = String(block.collection ?? "")
              if (!collection) return
              let entries = await fetcher.list(collection, {
                limit,
                where: { status: "published" },
              })
              // Best-effort tag filter: the list endpoint may not support tag membership.
              const filterTag = String(block.filterTag ?? "").trim()
              if (filterTag) {
                entries = entries.filter((entry) => {
                  const tags = entry.tags
                  return Array.isArray(tags) && tags.includes(filterTag)
                })
              }
              collectionData[i] = entries
            } catch {
              // Leave collectionData[i] undefined; serializer renders an empty band.
            }
          }),
        )
      }

      const html = portableTextToHtml(blocks, { apiBase: opts.apiBase, collectionData })
      return { html, leadsWithHero }
    } catch {
      return { html: "<p>Error rendering content.</p>", leadsWithHero: false }
    }
  }

  return { html: "", leadsWithHero: false }
}
