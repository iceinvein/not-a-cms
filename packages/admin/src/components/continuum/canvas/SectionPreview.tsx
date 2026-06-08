import { NodeViewWrapper } from "@tiptap/react"
import { renderSectionHtml } from "./render-section"

/**
 * Read-only Visual-mode node-view: renders a section block exactly as the public site
 * does. Phase 1 sections are display-only on the canvas; inline editing arrives in
 * Phase 2. The node is non-editable so ProseMirror does not place a cursor inside the
 * injected production markup.
 */
export function SectionPreview({ node }: any) {
  const html = renderSectionHtml(node.type.name, node.attrs ?? {})
  return (
    <NodeViewWrapper
      className="cn-visual-section"
      contentEditable={false}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML comes from the renderer's escaping, allowlist-based portable-text output (same source the public site uses)
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
