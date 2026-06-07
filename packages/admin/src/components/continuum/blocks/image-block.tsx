import { useEffect, useState } from "react"
import { NodeViewWrapper } from "@tiptap/react"
import { getAdminApiBase } from "../../../lib/api"
import { listMediaItems, type AdminMediaItem } from "../../../lib/media"

/**
 * Inline image block (F-013). Picks an image from the Vault and stores an absolute
 * URL plus the media id, so the renderer's existing Portable Text image handler can
 * display it on the public site. Uses the configured API base (not the admin origin)
 * so the picker reaches the API across origins.
 */
export function ImageBlockView({ node, updateAttributes }: any) {
  const apiBase = getAdminApiBase()
  const url = String(node.attrs.url ?? "")
  const alt = String(node.attrs.alt ?? "")
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AdminMediaItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    listMediaItems(apiBase)
      .then((all) => setItems(all.filter((item) => item.mimetype.startsWith("image/"))))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [open, apiBase])

  return (
    <NodeViewWrapper className="cn-block cn-image-block" contentEditable={false}>
      {url ? (
        <figure className="cn-image-figure">
          <img src={url} alt={alt} />
        </figure>
      ) : (
        <span className="cn-gallery-empty">No image selected</span>
      )}
      <div className="cn-image-actions">
        <button type="button" className="cn-block-action" onClick={() => setOpen((current) => !current)}>
          {url ? "Replace image" : "Choose image"}
        </button>
        {url && (
          <button type="button" className="cn-block-action" onClick={() => updateAttributes({ url: "", mediaId: "" })}>
            Remove
          </button>
        )}
      </div>
      <input
        className="cn-field-input cn-image-alt"
        type="text"
        placeholder="Alt text"
        value={alt}
        onChange={(event) => updateAttributes({ alt: event.target.value })}
      />
      {open && (
        <div className="cn-gallery-picker">
          {loading ? (
            <span className="cn-gallery-empty">Loading media...</span>
          ) : items.length === 0 ? (
            <span className="cn-gallery-empty">No images uploaded yet.</span>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="cn-gallery-choice"
                onClick={() => {
                  updateAttributes({ url: item.url, mediaId: item.id, alt: alt || item.alt || "" })
                  setOpen(false)
                }}
              >
                <img src={item.url} alt="" />
                <span>{item.filename}</span>
              </button>
            ))
          )}
        </div>
      )}
      <span className="cn-block-label">image</span>
    </NodeViewWrapper>
  )
}
