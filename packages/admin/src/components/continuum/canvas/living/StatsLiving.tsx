import { NodeViewWrapper } from "@tiptap/react"
import { EditableText } from "../EditableText"
import { useCanvasSelection } from "../selection"

type Stat = { value: string; label: string }
type Attrs = Record<string, unknown>

function stats(value: unknown): Stat[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const s = (item ?? {}) as Partial<Stat>
    return { value: String(s.value ?? ""), label: String(s.label ?? "") }
  })
}

type LivingProps = {
  attrs: Attrs
  editable?: boolean
  selected?: boolean
  setItems: (items: Stat[]) => void
  onFocusHole?: () => void
}

export function StatsLiving({
  attrs,
  editable = true,
  selected,
  setItems,
  onFocusHole,
}: LivingProps) {
  const items = stats(attrs.items)
  const columns = [2, 3, 4].includes(Number(attrs.columns)) ? Number(attrs.columns) : 3
  const patch = (index: number, field: keyof Stat, value: string) =>
    setItems(items.map((s, i) => (i === index ? { ...s, [field]: value } : s)))

  return (
    <section className={`nac-band nac-stats not-prose${selected ? " cn-selected" : ""}`}>
      <div className="nac-container">
        <div className="nac-stat-grid" data-columns={String(columns)}>
          {items.map((stat, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: positional cards; EditableText keeps the focused hole's caret stable across re-renders
            <div key={index} className="nac-stat">
              <EditableText
                as="div"
                className="nac-stat-value"
                value={stat.value}
                placeholder="Value"
                editable={editable}
                onChange={(v) => patch(index, "value", v)}
                onFocusHole={onFocusHole}
              />
              <EditableText
                as="div"
                className="nac-stat-label"
                value={stat.label}
                placeholder="Label"
                editable={editable}
                onChange={(v) => patch(index, "label", v)}
                onFocusHole={onFocusHole}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function StatsLivingView({ node, updateAttributes, selected, getPos }: any) {
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
      <StatsLiving
        attrs={node.attrs}
        selected={selected}
        setItems={(items) => updateAttributes({ items })}
        onFocusHole={markSelected}
      />
    </NodeViewWrapper>
  )
}
