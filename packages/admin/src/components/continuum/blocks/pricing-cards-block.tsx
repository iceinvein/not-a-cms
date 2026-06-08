import { NodeViewWrapper } from "@tiptap/react"
import { Checkbox } from "../../ui/Checkbox"

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
    const features = Array.isArray(t.features) ? t.features.map((f) => String(f)) : []
    return {
      name: String(t.name ?? ""),
      price: String(t.price ?? ""),
      period: String(t.period ?? ""),
      features,
      ctaLabel: String(t.ctaLabel ?? ""),
      ctaUrl: String(t.ctaUrl ?? ""),
      highlighted: Boolean(t.highlighted),
    }
  })
}

/**
 * Pricing cards section block: an optional heading followed by a responsive grid
 * of tier cards. Each tier has a name, price, period, features list, and an optional
 * CTA button. One tier can be marked as highlighted for an accented style.
 */
export function PricingCardsBlockView({ node, updateAttributes }: any) {
  const heading = String(node.attrs.heading ?? "")
  const tierList = tiers(node.attrs.tiers)

  const updateTiers = (next: Tier[]) => updateAttributes({ tiers: next })

  return (
    <NodeViewWrapper className="cn-block cn-section" contentEditable={false}>
      <input
        className="cn-block-input"
        value={heading}
        placeholder="Section heading (optional)"
        onChange={(event) => updateAttributes({ heading: event.target.value })}
      />
      <div className="cn-feature-cards">
        {tierList.map((tier, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: positional editable rows with no stable id; keying by content would remount the focused input on every keystroke
          <div key={index} className="cn-feature-card">
            <input
              className="cn-block-input"
              value={tier.name}
              placeholder="Tier name (e.g. Pro)"
              onChange={(event) =>
                updateTiers(
                  tierList.map((t, i) => (i === index ? { ...t, name: event.target.value } : t)),
                )
              }
            />
            <input
              className="cn-block-input"
              value={tier.price}
              placeholder="Price (e.g. $29)"
              onChange={(event) =>
                updateTiers(
                  tierList.map((t, i) => (i === index ? { ...t, price: event.target.value } : t)),
                )
              }
            />
            <input
              className="cn-block-input"
              value={tier.period}
              placeholder="Period (e.g. /month)"
              onChange={(event) =>
                updateTiers(
                  tierList.map((t, i) => (i === index ? { ...t, period: event.target.value } : t)),
                )
              }
            />
            <textarea
              className="cn-block-input cn-block-textarea"
              value={tier.features.join("\n")}
              placeholder={"Features, one per line"}
              onChange={(event) => {
                const features = event.target.value
                  .split("\n")
                  .map((f) => f.trim())
                  .filter(Boolean)
                updateTiers(tierList.map((t, i) => (i === index ? { ...t, features } : t)))
              }}
            />
            <input
              className="cn-block-input"
              value={tier.ctaLabel}
              placeholder="CTA label (e.g. Get started)"
              onChange={(event) =>
                updateTiers(
                  tierList.map((t, i) =>
                    i === index ? { ...t, ctaLabel: event.target.value } : t,
                  ),
                )
              }
            />
            <input
              className="cn-block-input"
              value={tier.ctaUrl}
              placeholder="CTA URL"
              onChange={(event) =>
                updateTiers(
                  tierList.map((t, i) => (i === index ? { ...t, ctaUrl: event.target.value } : t)),
                )
              }
            />
            <Checkbox
              label="Highlight this tier"
              checked={tier.highlighted}
              onCheckedChange={(value) =>
                updateTiers(
                  tierList.map((t, i) => (i === index ? { ...t, highlighted: value } : t)),
                )
              }
            />
            <button
              type="button"
              className="cn-block-action"
              onClick={() => updateTiers(tierList.filter((_, i) => i !== index))}
            >
              Remove tier
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="cn-block-action cn-block-cta"
        onClick={() =>
          updateTiers([
            ...tierList,
            {
              name: "",
              price: "",
              period: "",
              features: [],
              ctaLabel: "",
              ctaUrl: "",
              highlighted: false,
            },
          ])
        }
      >
        + Add tier
      </button>
      <span className="cn-block-label">pricing cards</span>
    </NodeViewWrapper>
  )
}
