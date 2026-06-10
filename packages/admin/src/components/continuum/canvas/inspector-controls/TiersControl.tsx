import { Checkbox } from "../../../ui/Checkbox"
import { humanizeFieldName } from "../../InspectorFields"
import type { ArrayControlProps } from "../Inspector"

type Tier = {
  name: string
  price: string
  period: string
  features: string[]
  ctaLabel: string
  ctaUrl: string
  highlighted: boolean
}

function tiers(value: unknown): Tier[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const t = (item ?? {}) as Partial<Tier>
    return {
      name: String(t.name ?? ""),
      price: String(t.price ?? ""),
      period: String(t.period ?? ""),
      features: Array.isArray(t.features) ? t.features.map((f) => String(f)) : [],
      ctaLabel: String(t.ctaLabel ?? ""),
      ctaUrl: String(t.ctaUrl ?? ""),
      highlighted: Boolean(t.highlighted),
    }
  })
}

const emptyTier: Tier = {
  name: "",
  price: "",
  period: "",
  features: [],
  ctaLabel: "",
  ctaUrl: "",
  highlighted: false,
}

/**
 * Inspector control for pricing tiers. Tier name, CTA label, and feature text are edited
 * inline on the canvas; this control edits price, period, CTA URL, the highlight flag, and
 * the add/remove of tiers and features.
 */
export function TiersControl({ value, onChange }: ArrayControlProps) {
  const list = tiers(value)
  const patch = (index: number, next: Partial<Tier>) =>
    onChange(list.map((t, i) => (i === index ? { ...t, ...next } : t)))

  return (
    <div className="cn-inspector-array">
      <span className="cn-field-label">{humanizeFieldName("tiers")}</span>
      {list.map((tier, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: positional tier rows
        <div key={index} className="cn-inspector-array-item">
          <span className="cn-inspector-array-heading">Tier {index + 1}</span>
          <input
            className="cn-field-input"
            value={tier.price}
            placeholder="Price (e.g. $29)"
            onChange={(e) => patch(index, { price: e.target.value })}
          />
          <input
            className="cn-field-input"
            value={tier.period}
            placeholder="Period (e.g. /month)"
            onChange={(e) => patch(index, { period: e.target.value })}
          />
          <input
            className="cn-field-input"
            value={tier.ctaUrl}
            placeholder="CTA URL"
            onChange={(e) => patch(index, { ctaUrl: e.target.value })}
          />
          <Checkbox
            label="Highlight this tier"
            checked={tier.highlighted}
            onCheckedChange={(checked) => patch(index, { highlighted: checked })}
          />
          <div className="cn-inspector-array-subrow">
            <span>Features: {tier.features.length}</span>
            <button
              type="button"
              className="cn-field-add"
              onClick={() => patch(index, { features: [...tier.features, ""] })}
            >
              + Add feature
            </button>
            {tier.features.length > 0 ? (
              <button
                type="button"
                className="cn-field-remove"
                aria-label="Remove last feature"
                onClick={() => patch(index, { features: tier.features.slice(0, -1) })}
              >
                - Feature
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className="cn-field-remove"
            aria-label={`Remove tier ${index + 1}`}
            onClick={() => onChange(list.filter((_, i) => i !== index))}
          >
            x Remove tier
          </button>
        </div>
      ))}
      <button type="button" className="cn-field-add" onClick={() => onChange([...list, { ...emptyTier }])}>
        + Add tier
      </button>
    </div>
  )
}
