import { NodeViewWrapper } from "@tiptap/react"
import { sanitizeUrl } from "@not-a-cms/renderer/web"
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

export function TestimonialLiving({ attrs, editable = true, selected, setText, onFocusHole }: LivingProps) {
  const avatar = String(attrs.avatar ?? "").trim()
  return (
    <section className={`nac-band nac-testimonial-block not-prose${selected ? " cn-selected" : ""}`}>
      <div className="nac-container">
        <figure className="nac-testimonial">
          <blockquote className="nac-quote">
            <EditableText
              as="p"
              value={String(attrs.quote ?? "")}
              placeholder="Quote"
              multiline
              editable={editable}
              omitWhenEmpty={false}
              onChange={(v) => setText("quote", v)}
              onFocusHole={onFocusHole}
            />
          </blockquote>
          <figcaption className="nac-quote-by">
            {avatar ? (
              <img className="nac-quote-avatar" src={sanitizeUrl(avatar, { allowDataImage: true })} alt="" />
            ) : null}
            <EditableText
              as="span"
              className="nac-quote-name"
              value={String(attrs.name ?? "")}
              placeholder="Name"
              editable={editable}
              omitWhenEmpty={false}
              onChange={(v) => setText("name", v)}
              onFocusHole={onFocusHole}
            />
            <EditableText
              as="span"
              className="nac-quote-role"
              value={String(attrs.role ?? "")}
              placeholder="Role"
              editable={editable}
              onChange={(v) => setText("role", v)}
              onFocusHole={onFocusHole}
            />
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

export function TestimonialLivingView({ node, updateAttributes, selected, getPos }: any) {
  const { select } = useCanvasSelection()
  const markSelected = () => {
    const pos = typeof getPos === "function" ? getPos() : null
    if (pos !== null && pos !== undefined) select({ pos, name: node.type.name })
  }
  return (
    <NodeViewWrapper className="cn-living" contentEditable={false} onPointerDownCapture={markSelected}>
      <TestimonialLiving
        attrs={node.attrs}
        selected={selected}
        setText={(field, value) => updateAttributes({ [field]: value })}
        onFocusHole={markSelected}
      />
    </NodeViewWrapper>
  )
}
