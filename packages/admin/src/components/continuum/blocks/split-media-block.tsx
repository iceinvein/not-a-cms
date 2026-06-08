import { NodeViewWrapper } from "@tiptap/react"
import { MediaPicker } from "./media-picker"
import { Select } from "../../ui/Select"

/**
 * Split media section block: a two-column layout with an image on one side and
 * heading, body text, and an optional CTA on the other. The side attribute controls
 * which column the image occupies.
 */
export function SplitMediaBlockView({ node, updateAttributes }: any) {
  const media = String(node.attrs.media ?? "")
  const side = String(node.attrs.side ?? "left")
  const heading = String(node.attrs.heading ?? "")
  const body = String(node.attrs.body ?? "")
  const ctaLabel = String(node.attrs.ctaLabel ?? "")
  const ctaUrl = String(node.attrs.ctaUrl ?? "")

  return (
    <NodeViewWrapper className="cn-block cn-section" contentEditable={false}>
      <MediaPicker
        value={media}
        chooseLabel="Media image"
        onSelect={(item) => updateAttributes({ media: item.url })}
        onClear={() => updateAttributes({ media: "" })}
      />
      <label className="cn-section-control">
        Media side
        <Select
          value={side}
          onValueChange={(value) => updateAttributes({ side: value })}
          ariaLabel="Media side"
          options={[
            { value: "left", label: "Image left" },
            { value: "right", label: "Image right" },
          ]}
        />
      </label>
      <input
        className="cn-block-input"
        value={heading}
        placeholder="Heading"
        onChange={(event) => updateAttributes({ heading: event.target.value })}
      />
      <textarea
        className="cn-block-input cn-block-textarea"
        value={body}
        placeholder="Body text"
        onChange={(event) => updateAttributes({ body: event.target.value })}
      />
      <input
        className="cn-block-input"
        value={ctaLabel}
        placeholder="CTA label (optional)"
        onChange={(event) => updateAttributes({ ctaLabel: event.target.value })}
      />
      <input
        className="cn-block-input"
        value={ctaUrl}
        placeholder="CTA URL (optional)"
        onChange={(event) => updateAttributes({ ctaUrl: event.target.value })}
      />
      <span className="cn-block-label">split media</span>
    </NodeViewWrapper>
  )
}
