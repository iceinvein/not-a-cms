import { NodeViewWrapper } from "@tiptap/react"

/**
 * Call-to-action block (F-012): a labelled button linking somewhere, with a style
 * variant. Renders as a branded button on the public site.
 */
export function CtaBlockView({ node, updateAttributes }: any) {
  const label = String(node.attrs.label ?? "")
  const url = String(node.attrs.url ?? "")
  const variant = String(node.attrs.variant ?? "primary")

  return (
    <NodeViewWrapper className="cn-block cn-section" contentEditable={false}>
      <input
        className="cn-block-input"
        value={label}
        placeholder="Button label"
        onChange={(event) => updateAttributes({ label: event.target.value })}
      />
      <input
        className="cn-block-input"
        value={url}
        placeholder="URL (e.g. /signup)"
        onChange={(event) => updateAttributes({ url: event.target.value })}
      />
      <label className="cn-section-control">
        Style
        <select value={variant} onChange={(event) => updateAttributes({ variant: event.target.value })}>
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
          <option value="outline">Outline</option>
        </select>
      </label>
      <span className="cn-block-label">cta</span>
    </NodeViewWrapper>
  )
}
