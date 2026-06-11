import { imageSource, sanitizeUrl } from "@not-a-cms/renderer/web"
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

export function SplitMediaLiving({
  attrs,
  editable = true,
  selected,
  setText,
  onFocusHole,
}: LivingProps) {
  const side = attrs.side === "right" ? "right" : "left"
  const mediaSrc = imageSource(attrs.media)
  const ctaLabel = String(attrs.ctaLabel ?? "").trim()
  const ctaHref = sanitizeUrl(attrs.ctaUrl)

  return (
    <section
      className={`nac-band nac-split-block not-prose${selected ? " cn-selected" : ""}`}
      {...spacingDataAttr(attrs.spacing)}
    >
      <div className="nac-container">
        <div className="nac-split" data-side={side}>
          <div className="nac-split-media">
            {mediaSrc.url ? (
              <img
                src={sanitizeUrl(mediaSrc.url, { allowDataImage: true })}
                alt=""
                data-media-id={mediaSrc.id || undefined}
              />
            ) : null}
          </div>
          <div className="nac-split-body">
            <EditableText
              as="h2"
              className="nac-split-heading"
              value={String(attrs.heading ?? "")}
              placeholder="Heading"
              editable={editable}
              onChange={(v) => setText("heading", v)}
              onFocusHole={onFocusHole}
            />
            <EditableText
              as="p"
              className="nac-split-text"
              value={String(attrs.body ?? "")}
              placeholder="Body text"
              multiline
              editable={editable}
              onChange={(v) => setText("body", v)}
              onFocusHole={onFocusHole}
            />
            {editable ? (
              <EditableText
                as="a"
                className="nac-cta-btn"
                value={String(attrs.ctaLabel ?? "")}
                placeholder="CTA label (optional)"
                editable
                onChange={(v) => setText("ctaLabel", v)}
                onFocusHole={onFocusHole}
              />
            ) : ctaLabel ? (
              <a className="nac-cta-btn" data-variant="primary" href={ctaHref}>
                {ctaLabel}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

export function SplitMediaLivingView({ node, updateAttributes, selected, getPos }: any) {
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
      <SplitMediaLiving
        attrs={node.attrs}
        selected={selected}
        setText={(field, value) => updateAttributes({ [field]: value })}
        onFocusHole={markSelected}
      />
    </NodeViewWrapper>
  )
}
