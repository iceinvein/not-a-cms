import { humanizeFieldName } from "../../InspectorFields"
import { MediaPicker } from "../../blocks/media-picker"
import type { ArrayControlProps } from "../Inspector"

type GalleryImage = { id: string; url: string }

function images(value: unknown): GalleryImage[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const img = (item ?? {}) as Partial<GalleryImage>
    return { id: String(img.id ?? ""), url: String(img.url ?? "") }
  })
}

/** Inspector control for the gallery: thumbnails with remove, plus a picker that appends. */
export function GalleryImagesControl({ value, onChange }: ArrayControlProps) {
  const items = images(value)
  return (
    <div className="cn-inspector-array">
      <span className="cn-field-label">{humanizeFieldName("images")}</span>
      <div className="cn-inspector-gallery">
        {items.map((img, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: positional gallery rows; duplicates make url non-unique
          <div key={index} className="cn-inspector-gallery-item">
            {img.url ? <img src={img.url} alt="" /> : null}
            <button
              type="button"
              className="cn-field-remove"
              aria-label={`Remove image ${index + 1}`}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              x
            </button>
          </div>
        ))}
      </div>
      <MediaPicker
        value=""
        chooseLabel="Add image"
        onSelect={(item) => onChange([...items, { id: item.id, url: item.url }])}
      />
    </div>
  )
}
