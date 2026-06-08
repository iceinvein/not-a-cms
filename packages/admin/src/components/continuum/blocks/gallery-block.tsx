import { NodeViewWrapper } from "@tiptap/react"
import { useEffect, useState } from "react"
import { type AdminMediaItem, listMediaItems, mediaDisplayUrl } from "../../../lib/media"

function imageValues(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function galleryImage(item: AdminMediaItem) {
  return { id: item.id, url: mediaDisplayUrl(item, "") }
}

export function GalleryBlockView({ node, updateAttributes }: any) {
  const images = imageValues(node.attrs.images)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AdminMediaItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    listMediaItems("")
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [open])

  return (
    <NodeViewWrapper className="cn-block cn-gallery" contentEditable={false}>
      <div className="cn-gallery-strip">
        {images.length === 0 ? (
          <span className="cn-gallery-empty">No images selected</span>
        ) : (
          images.map((image, index) => {
            const src = mediaDisplayUrl(image, "")
            return (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: the same media may appear more than once, so src alone is not unique; the index disambiguates duplicates
                key={`${src}-${index}`}
                type="button"
                className="cn-gallery-thumb"
                onClick={() =>
                  updateAttributes({ images: images.filter((_, itemIndex) => itemIndex !== index) })
                }
                title="Remove image"
              >
                {src ? <img src={src} alt="" /> : <span>Image</span>}
              </button>
            )
          })
        )}
      </div>
      <button
        type="button"
        className="cn-block-action cn-block-cta"
        onClick={() => setOpen((current) => !current)}
      >
        Add image
      </button>
      {open && (
        <div className="cn-gallery-picker">
          {loading ? (
            <span className="cn-gallery-empty">Loading media...</span>
          ) : items.length === 0 ? (
            <span className="cn-gallery-empty">No media uploaded yet.</span>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="cn-gallery-choice"
                onClick={() => {
                  updateAttributes({ images: [...images, galleryImage(item)] })
                  setOpen(false)
                }}
              >
                {item.mimetype.startsWith("image/") ? (
                  <img src={item.url} alt="" />
                ) : (
                  <span>File</span>
                )}
                <span>{item.filename}</span>
              </button>
            ))
          )}
        </div>
      )}
      <span className="cn-block-label">gallery</span>
    </NodeViewWrapper>
  )
}
