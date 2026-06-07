import { NodeViewWrapper } from "@tiptap/react"

/**
 * Hero section block (F-012): an eyebrow, headline, subheadline, and alignment.
 * Renders as a styled marketing hero band on the public site.
 */
export function HeroBlockView({ node, updateAttributes }: any) {
  const eyebrow = String(node.attrs.eyebrow ?? "")
  const headline = String(node.attrs.headline ?? "")
  const subheadline = String(node.attrs.subheadline ?? "")
  const align = String(node.attrs.align ?? "center")

  return (
    <NodeViewWrapper className="cn-block cn-section" contentEditable={false}>
      <input
        className="cn-block-input"
        value={eyebrow}
        placeholder="Eyebrow (optional)"
        onChange={(event) => updateAttributes({ eyebrow: event.target.value })}
      />
      <input
        className="cn-block-input cn-section-headline"
        value={headline}
        placeholder="Headline"
        onChange={(event) => updateAttributes({ headline: event.target.value })}
      />
      <textarea
        className="cn-block-input cn-block-textarea"
        value={subheadline}
        placeholder="Subheadline"
        onChange={(event) => updateAttributes({ subheadline: event.target.value })}
      />
      <label className="cn-section-control">
        Alignment
        <select value={align} onChange={(event) => updateAttributes({ align: event.target.value })}>
          <option value="center">Center</option>
          <option value="left">Left</option>
        </select>
      </label>
      <span className="cn-block-label">hero</span>
    </NodeViewWrapper>
  )
}
