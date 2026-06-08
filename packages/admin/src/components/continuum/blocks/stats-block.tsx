import { NodeViewWrapper } from "@tiptap/react"
import { Select } from "../../ui/Select"

type StatItem = { value: string; label: string }

function statItems(value: unknown): StatItem[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const stat = (item ?? {}) as Partial<StatItem>
    return { value: String(stat.value ?? ""), label: String(stat.label ?? "") }
  })
}

/**
 * Stats section block: a grid of key-value pairs (value + label) for social proof
 * sections. Renders as a responsive stat grid on the public site.
 */
export function StatsBlockView({ node, updateAttributes }: any) {
  const items = statItems(node.attrs.items)
  const columns = [2, 3, 4].includes(Number(node.attrs.columns)) ? Number(node.attrs.columns) : 3

  const update = (next: StatItem[]) => updateAttributes({ items: next })

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
        {items.map((stat, index) => (
          <div key={index} className="cn-feature-card">
            <input
              className="cn-block-input cn-feature-icon-input"
              value={stat.value}
              placeholder="Value (e.g. 10k+)"
              onChange={(event) =>
                update(items.map((s, i) => (i === index ? { ...s, value: event.target.value } : s)))
              }
            />
            <input
              className="cn-block-input"
              value={stat.label}
              placeholder="Label (e.g. Users)"
              onChange={(event) =>
                update(items.map((s, i) => (i === index ? { ...s, label: event.target.value } : s)))
              }
            />
            <button
              type="button"
              className="cn-block-action"
              onClick={() => update(items.filter((_, i) => i !== index))}
            >
              Remove stat
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="cn-block-action cn-block-cta" onClick={() => update([...items, { value: "", label: "" }])}>
        + Add stat
      </button>
      <span className="cn-block-label">stats</span>
    </NodeViewWrapper>
  )
}
