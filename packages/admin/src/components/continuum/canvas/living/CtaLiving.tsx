// packages/admin/src/components/continuum/canvas/living/CtaLiving.tsx
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

/**
 * Presentational CTA, matching the production renderer's "cta" case. The button label is an
 * inline hole; url and variant are inspector-only. The renderer's empty-label default
 * ("Learn more") is reproduced so static parity holds, but in editable mode the empty hole
 * shows a placeholder instead so the author can type the real label.
 */
export function CtaLiving({ attrs, editable = true, selected, setText, onFocusHole }: LivingProps) {
  const variant =
    attrs.variant === "outline" ? "outline" : attrs.variant === "secondary" ? "secondary" : "primary"
  const href = sanitizeUrl(attrs.url)
  const label = String(attrs.label ?? "")

  return (
    <div className={`nac-band nac-cta not-prose${selected ? " cn-selected" : ""}`}>
      <div className="nac-container">
        {editable ? (
          <EditableText
            as="a"
            className="nac-cta-btn"
            value={label}
            placeholder="Button label"
            editable
            onChange={(v) => setText("label", v)}
            onFocusHole={onFocusHole}
          />
        ) : (
          <a className="nac-cta-btn" data-variant={variant} href={href}>
            {attrs.label == null ? "Learn more" : label}
          </a>
        )}
      </div>
    </div>
  )
}

export function CtaLivingView({ node, updateAttributes, selected, getPos }: any) {
  const { select } = useCanvasSelection()
  const markSelected = () => {
    const pos = typeof getPos === "function" ? getPos() : null
    if (pos !== null && pos !== undefined) select({ pos, name: node.type.name })
  }
  return (
    <NodeViewWrapper className="cn-living" contentEditable={false} onPointerDownCapture={markSelected}>
      <CtaLiving
        attrs={node.attrs}
        selected={selected}
        setText={(field, value) => updateAttributes({ [field]: value })}
        onFocusHole={markSelected}
      />
    </NodeViewWrapper>
  )
}
