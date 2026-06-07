import { NodeViewWrapper } from "@tiptap/react"

type FeatureCard = { title: string; text: string }

function cards(value: unknown): FeatureCard[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const card = (item ?? {}) as Partial<FeatureCard>
    return { title: String(card.title ?? ""), text: String(card.text ?? "") }
  })
}

/**
 * Feature grid block (F-012): a set of title/text cards rendered as responsive
 * columns on the public site, for "why teams switch"-style sections.
 */
export function FeatureGridBlockView({ node, updateAttributes }: any) {
  const items = cards(node.attrs.items)

  const update = (next: FeatureCard[]) => updateAttributes({ items: next })

  return (
    <NodeViewWrapper className="cn-block cn-section" contentEditable={false}>
      <div className="cn-feature-cards">
        {items.map((card, index) => (
          <div key={index} className="cn-feature-card">
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
      <button type="button" className="cn-block-action" onClick={() => update([...items, { title: "", text: "" }])}>
        + Add card
      </button>
      <span className="cn-block-label">feature grid</span>
    </NodeViewWrapper>
  )
}
