import { NodeViewWrapper } from "@tiptap/react"
import { EditableText } from "../EditableText"
import { useCanvasSelection } from "../selection"
import { spacingDataAttr } from "../spacing"

type Attrs = Record<string, unknown>

type LivingProps = {
  attrs: Attrs
  editable?: boolean
  selected?: boolean
  setText: (field: string, value: string) => void
  onFocusHole?: () => void
}

export function CollectionListLiving({
  attrs,
  editable = true,
  selected,
  setText,
  onFocusHole,
}: LivingProps) {
  const layout = ["grid", "list", "cards"].includes(String(attrs.layout))
    ? String(attrs.layout)
    : "grid"
  return (
    <section
      className={`nac-band nac-collection-block not-prose${selected ? " cn-selected" : ""}`}
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
        <div className="nac-collection" data-layout={layout} />
      </div>
    </section>
  )
}

export function CollectionListLivingView({ node, updateAttributes, selected, getPos }: any) {
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
      <CollectionListLiving
        attrs={node.attrs}
        selected={selected}
        setText={(field, value) => updateAttributes({ [field]: value })}
        onFocusHole={markSelected}
      />
    </NodeViewWrapper>
  )
}
