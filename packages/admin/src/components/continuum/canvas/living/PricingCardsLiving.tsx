import { NodeViewWrapper } from "@tiptap/react"
import { sanitizeUrl } from "@not-a-cms/renderer/web"
import { useCanvasSelection } from "../selection"
import { EditableText } from "../EditableText"

type Tier = {
  name: string
  price: string
  period: string
  features: string[]
  ctaLabel: string
  ctaUrl: string
  highlighted: boolean
}
type Attrs = Record<string, unknown>

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

type LivingProps = {
  attrs: Attrs
  editable?: boolean
  selected?: boolean
  setText: (field: string, value: string) => void
  setTiers: (tiers: Tier[]) => void
  onFocusHole?: () => void
}

export function PricingCardsLiving({ attrs, editable = true, selected, setText, setTiers, onFocusHole }: LivingProps) {
  const list = tiers(attrs.tiers)
  const patch = (index: number, next: Partial<Tier>) =>
    setTiers(list.map((t, i) => (i === index ? { ...t, ...next } : t)))

  return (
    <section className={`nac-band nac-pricing-cards not-prose${selected ? " cn-selected" : ""}`}>
      <div className="nac-container">
        <EditableText
          as="h2"
          className="nac-section-heading"
          value={String(attrs.heading ?? "")}
          placeholder="Section heading"
          editable={editable}
          onChange={(v) => setText("heading", v)}
          onFocusHole={onFocusHole}
        />
        <div className="nac-pricing">
          {list.map((tier, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: positional tiers; EditableText keeps holes caret-stable
            <div key={index} className="nac-tier" data-highlight={String(tier.highlighted)}>
              <EditableText
                as="h3"
                className="nac-tier-name"
                value={tier.name}
                placeholder="Tier name"
                editable={editable}
                omitWhenEmpty={false}
                onChange={(v) => patch(index, { name: v })}
                onFocusHole={onFocusHole}
              />
              <div className="nac-tier-price">
                {tier.price}
                {tier.period ? <span className="nac-tier-period">{tier.period}</span> : null}
              </div>
              <ul className="nac-tier-features">
                {tier.features.map((feature, fIndex) => (
                  <EditableText
                    // biome-ignore lint/suspicious/noArrayIndexKey: positional feature rows
                    key={fIndex}
                    as="li"
                    value={feature}
                    placeholder="Feature"
                    editable={editable}
                    omitWhenEmpty={false}
                    onChange={(v) =>
                      patch(index, { features: tier.features.map((f, i) => (i === fIndex ? v : f)) })
                    }
                    onFocusHole={onFocusHole}
                  />
                ))}
              </ul>
              {editable ? (
                <EditableText
                  as="a"
                  className="nac-cta-btn"
                  value={tier.ctaLabel}
                  placeholder="CTA label (optional)"
                  editable
                  onChange={(v) => patch(index, { ctaLabel: v })}
                  onFocusHole={onFocusHole}
                />
              ) : tier.ctaLabel.trim() ? (
                <a className="nac-cta-btn" data-variant="primary" href={sanitizeUrl(tier.ctaUrl)}>
                  {tier.ctaLabel}
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function PricingCardsLivingView({ node, updateAttributes, selected, getPos }: any) {
  const { select } = useCanvasSelection()
  const markSelected = () => {
    const pos = typeof getPos === "function" ? getPos() : null
    if (pos !== null && pos !== undefined) select({ pos, name: node.type.name })
  }
  return (
    <NodeViewWrapper className="cn-living" contentEditable={false} onPointerDownCapture={markSelected}>
      <PricingCardsLiving
        attrs={node.attrs}
        selected={selected}
        setText={(field, value) => updateAttributes({ [field]: value })}
        setTiers={(tiers) => updateAttributes({ tiers })}
        onFocusHole={markSelected}
      />
    </NodeViewWrapper>
  )
}
