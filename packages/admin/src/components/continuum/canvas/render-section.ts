import { renderPortableText } from "@not-a-cms/renderer/web"

/**
 * Render a single section block to its production HTML for the read-only Visual
 * canvas. The node's attributes are the Portable Text block fields, so the block is
 * `{ type, ...attrs }`, rendered through the same renderer the public site uses.
 * collectionList renders its section shell without live entries here (no collectionData
 * is available client-side in Phase 1); live entries arrive in a later phase.
 */
export function renderSectionHtml(name: string, attrs: Record<string, unknown>): string {
  return renderPortableText([{ type: name, ...attrs }], "web")
}
