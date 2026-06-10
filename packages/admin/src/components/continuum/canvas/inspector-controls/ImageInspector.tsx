import { MediaPicker } from "../../blocks/media-picker"
import type { BlockInspectorProps } from "../Inspector"

/** Whole-block inspector for the image block: pick the image (sets url+mediaId+alt) and edit alt. */
export function ImageInspector({ attrs, setAttrs }: BlockInspectorProps) {
  const url = String(attrs.url ?? "")
  const alt = String(attrs.alt ?? "")
  return (
    <>
      <div className="cn-field">
        <span className="cn-field-label">Image</span>
        <MediaPicker
          value={url}
          chooseLabel="Choose image"
          onSelect={(item) => setAttrs({ url: item.url, mediaId: item.id, alt: alt || item.alt || "" })}
          onClear={() => setAttrs({ url: "", mediaId: "" })}
        />
      </div>
      <label className="cn-field" htmlFor="cn-image-alt">
        <span className="cn-field-label">Alt text</span>
        <input
          id="cn-image-alt"
          className="cn-field-input"
          value={alt}
          onChange={(e) => setAttrs({ alt: e.target.value })}
        />
      </label>
    </>
  )
}
