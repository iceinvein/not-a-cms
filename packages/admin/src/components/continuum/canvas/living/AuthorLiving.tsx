import { NodeViewWrapper } from "@tiptap/react"
import { useCanvasSelection } from "../selection"
import { EditableText } from "../EditableText"

type Attrs = Record<string, unknown>

type LivingProps = {
  attrs: Attrs
  editable?: boolean
  selected?: boolean
  setText: (field: string, value: string) => void
  onFocusHole?: () => void
}

export function AuthorLiving({ attrs, editable = true, selected, setText, onFocusHole }: LivingProps) {
  return (
    <div data-author="" className={selected ? "cn-selected" : undefined}>
      <EditableText
        as="span"
        domAttributes={{ "data-author-name": "" }}
        value={String(attrs.name ?? "")}
        placeholder="Author name"
        editable={editable}
        omitWhenEmpty={false}
        onChange={(v) => setText("name", v)}
        onFocusHole={onFocusHole}
      />
      <EditableText
        as="span"
        domAttributes={{ "data-author-role": "" }}
        value={String(attrs.role ?? "")}
        placeholder="Role"
        editable={editable}
        onChange={(v) => setText("role", v)}
        onFocusHole={onFocusHole}
      />
    </div>
  )
}

export function AuthorLivingView({ node, updateAttributes, selected, getPos }: any) {
  const { select } = useCanvasSelection()
  const markSelected = () => {
    const pos = typeof getPos === "function" ? getPos() : null
    if (pos !== null && pos !== undefined) select({ pos, name: node.type.name })
  }
  return (
    <NodeViewWrapper className="cn-living" contentEditable={false} onPointerDownCapture={markSelected}>
      <AuthorLiving
        attrs={node.attrs}
        selected={selected}
        setText={(field, value) => updateAttributes({ [field]: value })}
        onFocusHole={markSelected}
      />
    </NodeViewWrapper>
  )
}
