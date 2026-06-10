// packages/admin/src/components/continuum/canvas/living/FeatureGridLiving.tsx
import { NodeViewWrapper } from "@tiptap/react"
import { EditableText } from "../EditableText"
import { useCanvasSelection } from "../selection"

type FeatureCard = { icon: string; title: string; text: string }
type Attrs = Record<string, unknown>

function cards(value: unknown): FeatureCard[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const card = (item ?? {}) as Partial<FeatureCard>
    return {
      icon: String(card.icon ?? ""),
      title: String(card.title ?? ""),
      text: String(card.text ?? ""),
    }
  })
}

type LivingProps = {
  attrs: Attrs
  editable?: boolean
  selected?: boolean
  setItems: (items: FeatureCard[]) => void
  onFocusHole?: () => void
}

/**
 * Presentational feature grid, matching the production renderer's "featureGrid" case. Each
 * card's icon/title/text is an inline hole that writes back the whole items array. Column
 * count and add/remove of cards are inspector controls.
 */
export function FeatureGridLiving({
  attrs,
  editable = true,
  selected,
  setItems,
  onFocusHole,
}: LivingProps) {
  const items = cards(attrs.items)
  const columns = [2, 3, 4].includes(Number(attrs.columns)) ? Number(attrs.columns) : 3
  const patch = (index: number, field: keyof FeatureCard, value: string) =>
    setItems(items.map((card, i) => (i === index ? { ...card, [field]: value } : card)))

  return (
    <section className={`nac-band nac-features not-prose${selected ? " cn-selected" : ""}`}>
      <div className="nac-container">
        <div className="nac-feature-grid" data-columns={String(columns)}>
          {items.map((card, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: positional cards with no stable id; the inline holes are caret-stable via EditableText, and keying by content would remount the focused hole each keystroke
            <div key={index} className="nac-feature">
              <EditableText
                as="div"
                className="nac-feature-icon"
                value={card.icon}
                placeholder="Icon"
                editable={editable}
                onChange={(v) => patch(index, "icon", v)}
                onFocusHole={onFocusHole}
              />
              <EditableText
                as="h3"
                className="nac-feature-title"
                value={card.title}
                placeholder="Card title"
                editable={editable}
                onChange={(v) => patch(index, "title", v)}
                onFocusHole={onFocusHole}
              />
              <EditableText
                as="p"
                className="nac-feature-text"
                value={card.text}
                placeholder="Card text"
                multiline
                editable={editable}
                onChange={(v) => patch(index, "text", v)}
                onFocusHole={onFocusHole}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function FeatureGridLivingView({ node, updateAttributes, selected, getPos }: any) {
  const { select } = useCanvasSelection()
  const markSelected = () => {
    const pos = typeof getPos === "function" ? getPos() : null
    if (pos !== null && pos !== undefined) select({ pos, name: node.type.name })
  }
  return (
    <NodeViewWrapper
      className="cn-living"
      contentEditable={false}
      onPointerDownCapture={markSelected}
    >
      <FeatureGridLiving
        attrs={node.attrs}
        selected={selected}
        setItems={(items) => updateAttributes({ items })}
        onFocusHole={markSelected}
      />
    </NodeViewWrapper>
  )
}
