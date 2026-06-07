import { NodeViewWrapper } from "@tiptap/react"
import { MediaPicker } from "./media-picker"

/**
 * Testimonial section block: a pull-quote with author name, role, and an optional
 * avatar image picked from the Vault. Renders as a centered figure on the public site.
 */
export function TestimonialBlockView({ node, updateAttributes }: any) {
  const quote = String(node.attrs.quote ?? "")
  const name = String(node.attrs.name ?? "")
  const role = String(node.attrs.role ?? "")
  const avatar = String(node.attrs.avatar ?? "")

  return (
    <NodeViewWrapper className="cn-block cn-section" contentEditable={false}>
      <textarea
        className="cn-block-input cn-block-textarea"
        value={quote}
        placeholder="Quote"
        onChange={(event) => updateAttributes({ quote: event.target.value })}
      />
      <input
        className="cn-block-input"
        value={name}
        placeholder="Name"
        onChange={(event) => updateAttributes({ name: event.target.value })}
      />
      <input
        className="cn-block-input"
        value={role}
        placeholder="Role or company (optional)"
        onChange={(event) => updateAttributes({ role: event.target.value })}
      />
      <MediaPicker
        value={avatar}
        chooseLabel="Avatar image"
        onSelect={(item) => updateAttributes({ avatar: item.url })}
        onClear={() => updateAttributes({ avatar: "" })}
      />
      <span className="cn-block-label">testimonial</span>
    </NodeViewWrapper>
  )
}
