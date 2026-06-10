// packages/admin/src/components/continuum/canvas/living/HeroLiving.tsx
import { NodeViewWrapper } from "@tiptap/react"
import { cssUrl, sanitizeUrl } from "@not-a-cms/renderer/web"
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
 * Presentational hero, emitting the same markup as the production renderer's "hero" case.
 * Visible text (eyebrow/headline/subheadline) is rendered through EditableText; the
 * background/align/overlay are derived statically and edited in the inspector.
 */
export function HeroLiving({ attrs, editable = true, selected, setText, onFocusHole }: LivingProps) {
  const align = attrs.align === "left" ? "left" : "center"
  const bgRaw = attrs.backgroundImage ? String(attrs.backgroundImage) : ""
  const bgSanitized = bgRaw ? sanitizeUrl(bgRaw, { allowDataImage: true }) : ""
  const bgUrl = bgSanitized && bgSanitized !== "#" ? cssUrl(bgSanitized) : ""
  const hasBg = Boolean(bgUrl)
  const overlay = hasBg && attrs.overlay !== false

  return (
    <section
      className={`nac-band nac-hero not-prose${selected ? " cn-selected" : ""}`}
      data-align={align}
      data-has-bg={String(hasBg)}
      data-overlay={String(overlay)}
      style={hasBg ? { backgroundImage: `url('${bgUrl}')` } : undefined}
    >
      <div className="nac-container">
        <EditableText
          as="p"
          className="nac-hero-eyebrow"
          value={String(attrs.eyebrow ?? "")}
          placeholder="Eyebrow"
          editable={editable}
          onChange={(v) => setText("eyebrow", v)}
          onFocusHole={onFocusHole}
        />
        <EditableText
          as="h1"
          className="nac-hero-headline"
          value={String(attrs.headline ?? "")}
          placeholder="Headline"
          editable={editable}
          onChange={(v) => setText("headline", v)}
          onFocusHole={onFocusHole}
        />
        <EditableText
          as="p"
          className="nac-hero-sub"
          value={String(attrs.subheadline ?? "")}
          placeholder="Subheadline"
          multiline
          editable={editable}
          onChange={(v) => setText("subheadline", v)}
          onFocusHole={onFocusHole}
        />
      </div>
    </section>
  )
}

/**
 * Tiptap node-view for hero on the Visual canvas. Wraps the presentational component, wires
 * per-field text writes to updateAttributes, and registers itself with the selection
 * context (so the inspector tracks it) on focus/pointer-down.
 */
export function HeroLivingView({ node, updateAttributes, selected, getPos }: any) {
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
      <HeroLiving
        attrs={node.attrs}
        selected={selected}
        setText={(field, value) => updateAttributes({ [field]: value })}
        onFocusHole={markSelected}
      />
    </NodeViewWrapper>
  )
}
