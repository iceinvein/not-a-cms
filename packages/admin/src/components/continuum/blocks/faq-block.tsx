import { NodeViewWrapper } from "@tiptap/react"

type FaqItem = { question: string; answer: string }

function faqItems(value: unknown): FaqItem[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const entry = (item ?? {}) as Partial<FaqItem>
    return { question: String(entry.question ?? ""), answer: String(entry.answer ?? "") }
  })
}

/**
 * FAQ section block: an optional heading followed by a list of question/answer pairs
 * rendered as native <details> elements (no JS required) on the public site.
 */
export function FaqBlockView({ node, updateAttributes }: any) {
  const heading = String(node.attrs.heading ?? "")
  const items = faqItems(node.attrs.items)

  const update = (next: FaqItem[]) => updateAttributes({ items: next })

  return (
    <NodeViewWrapper className="cn-block cn-section" contentEditable={false}>
      <input
        className="cn-block-input"
        value={heading}
        placeholder="Section heading (optional)"
        onChange={(event) => updateAttributes({ heading: event.target.value })}
      />
      <div className="cn-feature-cards">
        {items.map((item, index) => (
          <div key={index} className="cn-feature-card">
            <input
              className="cn-block-input"
              value={item.question}
              placeholder="Question"
              onChange={(event) =>
                update(
                  items.map((it, i) =>
                    i === index ? { ...it, question: event.target.value } : it,
                  ),
                )
              }
            />
            <textarea
              className="cn-block-input cn-block-textarea"
              value={item.answer}
              placeholder="Answer"
              onChange={(event) =>
                update(
                  items.map((it, i) => (i === index ? { ...it, answer: event.target.value } : it)),
                )
              }
            />
            <button
              type="button"
              className="cn-block-action"
              onClick={() => update(items.filter((_, i) => i !== index))}
            >
              Remove item
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="cn-block-action cn-block-cta"
        onClick={() => update([...items, { question: "", answer: "" }])}
      >
        + Add item
      </button>
      <span className="cn-block-label">faq</span>
    </NodeViewWrapper>
  )
}
