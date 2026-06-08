import { NodeViewWrapper } from "@tiptap/react"
import { Select } from "../../ui/Select"

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
        <Select
          value={variant}
          onValueChange={(value) => updateAttributes({ variant: value })}
          ariaLabel="Button style"
          options={[
            { value: "primary", label: "Primary" },
            { value: "secondary", label: "Secondary" },
            { value: "outline", label: "Outline" },
          ]}
        />
      </label>
      <span className="cn-block-label">cta</span>
    </NodeViewWrapper>
  )
}
