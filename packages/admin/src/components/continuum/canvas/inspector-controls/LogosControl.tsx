import { humanizeFieldName } from "../../InspectorFields"
import { MediaPicker } from "../../blocks/media-picker"
import type { ArrayControlProps } from "../Inspector"

type Logo = { url: string; mediaId: string; alt: string }

function logos(value: unknown): Logo[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const l = (item ?? {}) as Partial<Logo>
    return { url: String(l.url ?? ""), mediaId: String(l.mediaId ?? ""), alt: String(l.alt ?? "") }
  })
}

/** Inspector control for logoCloud's logos: pick an image and alt per logo, add/remove. */
export function LogosControl({ value, onChange }: ArrayControlProps) {
  const items = logos(value)
  const update = (next: Logo[]) => onChange(next)
  return (
    <div className="cn-inspector-array">
      <span className="cn-field-label">{humanizeFieldName("logos")}</span>
      {items.map((logo, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: positional logo rows with no stable id
        <div key={index} className="cn-inspector-array-item">
          <MediaPicker
            value={logo.url}
            chooseLabel="Choose logo"
            onSelect={(item) =>
              update(items.map((l, i) => (i === index ? { url: item.url, mediaId: item.id, alt: l.alt } : l)))
            }
            onClear={() => update(items.map((l, i) => (i === index ? { url: "", mediaId: "", alt: l.alt } : l)))}
          />
          <input
            className="cn-field-input"
            value={logo.alt}
            placeholder="Alt text (company name)"
            onChange={(e) => update(items.map((l, i) => (i === index ? { ...l, alt: e.target.value } : l)))}
          />
          <button
            type="button"
            className="cn-field-remove"
            aria-label={`Remove logo ${index + 1}`}
            onClick={() => update(items.filter((_, i) => i !== index))}
          >
            x
          </button>
        </div>
      ))}
      <button
        type="button"
        className="cn-field-add"
        onClick={() => update([...items, { url: "", mediaId: "", alt: "" }])}
      >
        + Add logo
      </button>
    </div>
  )
}
