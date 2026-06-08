import { NodeViewWrapper } from "@tiptap/react"
import { Select } from "../../ui/Select"

type FeatureCard = { icon: string; title: string; text: string }

function cards(value: unknown): FeatureCard[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const card = (item ?? {}) as Partial<FeatureCard>
    return { icon: String(card.icon ?? ""), title: String(card.title ?? ""), text: String(card.text ?? "") }
  })
}

/**
 * Feature grid block (F-012): a set of icon/title/text cards rendered as responsive
 * columns on the public site, for "why teams switch"-style sections.
 */
export function FeatureGridBlockView({ node, updateAttributes }: any) {
  const items = cards(node.attrs.items)
  const columns = [2, 3, 4].includes(Number(node.attrs.columns)) ? Number(node.attrs.columns) : 3

  const update = (next: FeatureCard[]) => updateAttributes({ items: next })

  return (
    <NodeViewWrapper className="cn-block cn-section" contentEditable={false}>
      <label className="cn-section-control">
        Columns
        <Select
          value={String(columns)}
          onValueChange={(value) => updateAttributes({ columns: Number(value) })}
          ariaLabel="Columns"
          options={[
            { value: "2", label: "2" },
            { value: "3", label: "3" },
            { value: "4", label: "4" },
          ]}
        />
      </label>
      <div className="cn-feature-cards">
        {items.map((card, index) => (
          <div key={index} className="cn-feature-card">
            <input
              className="cn-block-input cn-feature-icon-input"
              value={card.icon}
              placeholder="Icon (emoji, optional)"
              onChange={(event) => update(items.map((c, i) => (i === index ? { ...c, icon: event.target.value } : c)))}
            />
            <input
              className="cn-block-input"
              value={card.title}
              placeholder="Card title"
              onChange={(event) => update(items.map((c, i) => (i === index ? { ...c, title: event.target.value } : c)))}
            />
            <textarea
              className="cn-block-input cn-block-textarea"
              value={card.text}
              placeholder="Card text"
              onChange={(event) => update(items.map((c, i) => (i === index ? { ...c, text: event.target.value } : c)))}
            />
            <button
              type="button"
              className="cn-block-action"
              onClick={() => update(items.filter((_, i) => i !== index))}
            >
              Remove card
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="cn-block-action cn-block-cta" onClick={() => update([...items, { icon: "", title: "", text: "" }])}>
        + Add card
      </button>
      <span className="cn-block-label">feature grid</span>
    </NodeViewWrapper>
  )
}
