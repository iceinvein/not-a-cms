import { NodeViewWrapper } from "@tiptap/react"
import { EditableText } from "../EditableText"
import { useCanvasSelection } from "../selection"
import { spacingDataAttr } from "../spacing"

type FaqItem = { question: string; answer: string }
type Attrs = Record<string, unknown>

function items(value: unknown): FaqItem[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const it = (item ?? {}) as Partial<FaqItem>
    return { question: String(it.question ?? ""), answer: String(it.answer ?? "") }
  })
}

type LivingProps = {
  attrs: Attrs
  editable?: boolean
  selected?: boolean
  setText: (field: string, value: string) => void
  setItems: (items: FaqItem[]) => void
  onFocusHole?: () => void
}

export function FaqLiving({
  attrs,
  editable = true,
  selected,
  setText,
  setItems,
  onFocusHole,
}: LivingProps) {
  const list = items(attrs.items)
  const patch = (index: number, field: keyof FaqItem, value: string) =>
    setItems(list.map((it, i) => (i === index ? { ...it, [field]: value } : it)))

  return (
    <section
      className={`nac-band nac-faq-block not-prose${selected ? " cn-selected" : ""}`}
      {...spacingDataAttr(attrs.spacing)}
    >
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
        <div className="nac-faq">
          {list.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: positional FAQ rows; EditableText keeps the caret stable
            <details key={index} className="nac-faq-item" open={editable || undefined}>
              <EditableText
                as="summary"
                className="nac-faq-q"
                value={item.question}
                placeholder="Question"
                editable={editable}
                omitWhenEmpty={false}
                onChange={(v) => patch(index, "question", v)}
                onFocusHole={onFocusHole}
              />
              <EditableText
                as="div"
                className="nac-faq-a"
                value={item.answer}
                placeholder="Answer"
                multiline
                editable={editable}
                omitWhenEmpty={false}
                onChange={(v) => patch(index, "answer", v)}
                onFocusHole={onFocusHole}
              />
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

export function FaqLivingView({ node, updateAttributes, selected, getPos }: any) {
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
      <FaqLiving
        attrs={node.attrs}
        selected={selected}
        setText={(field, value) => updateAttributes({ [field]: value })}
        setItems={(items) => updateAttributes({ items })}
        onFocusHole={markSelected}
      />
    </NodeViewWrapper>
  )
}
