import { NodeViewWrapper } from "@tiptap/react"
import { MediaPicker } from "./media-picker"

/**
 * Hero section block (F-012): an eyebrow, headline, subheadline, alignment, and an
 * optional background image with a contrast overlay. Renders as a full-bleed hero band.
 */
export function HeroBlockView({ node, updateAttributes }: any) {
  const eyebrow = String(node.attrs.eyebrow ?? "")
  const headline = String(node.attrs.headline ?? "")
  const subheadline = String(node.attrs.subheadline ?? "")
  const align = String(node.attrs.align ?? "center")
  const backgroundImage = String(node.attrs.backgroundImage ?? "")
  const overlay = node.attrs.overlay !== false

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
      <div className="cn-section-controls">
        <label className="cn-section-control">
          Alignment
          <select value={align} onChange={(event) => updateAttributes({ align: event.target.value })}>
            <option value="center">Center</option>
            <option value="left">Left</option>
          </select>
        </label>
        <label className="cn-section-control">
          <input
            type="checkbox"
            checked={overlay}
            onChange={(event) => updateAttributes({ overlay: event.target.checked })}
          />
          Darken background
        </label>
      </div>
      <MediaPicker
        value={backgroundImage}
        chooseLabel="Background image"
        onSelect={(item) => updateAttributes({ backgroundImage: item.url })}
        onClear={() => updateAttributes({ backgroundImage: "" })}
      />
      <span className="cn-block-label">hero</span>
    </NodeViewWrapper>
  )
}
