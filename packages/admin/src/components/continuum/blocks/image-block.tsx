import { NodeViewWrapper } from "@tiptap/react"
import { MediaPicker } from "./media-picker"

/**
 * Inline image block (F-013). Picks an image from the Vault and stores an absolute
 * URL plus the media id, so the renderer's existing Portable Text image handler can
 * display it on the public site.
 */
export function ImageBlockView({ node, updateAttributes }: any) {
  const url = String(node.attrs.url ?? "")
  const alt = String(node.attrs.alt ?? "")

  return (
    <NodeViewWrapper className="cn-block cn-image-block" contentEditable={false}>
      {url ? (
        <figure className="cn-image-figure">
          <img src={url} alt={alt} />
        </figure>
      ) : (
        <span className="cn-gallery-empty">No image selected</span>
      )}
      <MediaPicker
        value={url}
        onSelect={(item) =>
          updateAttributes({ url: item.url, mediaId: item.id, alt: alt || item.alt || "" })
        }
        onClear={() => updateAttributes({ url: "", mediaId: "" })}
      />
      <input
        className="cn-field-input cn-image-alt"
        type="text"
        placeholder="Alt text"
        value={alt}
        onChange={(event) => updateAttributes({ alt: event.target.value })}
      />
      <span className="cn-block-label">image</span>
    </NodeViewWrapper>
  )
}
