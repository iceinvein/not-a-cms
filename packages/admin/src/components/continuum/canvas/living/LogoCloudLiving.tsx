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
  setEyebrow: (value: string) => void
  onFocusHole?: () => void
}

export function LogoCloudLiving({
  attrs,
  editable = true,
  selected,
  setEyebrow,
  onFocusHole,
}: LivingProps) {
  const logos = Array.isArray(attrs.logos) ? attrs.logos : []
  return (
    <section
      className={`nac-band nac-logo-cloud not-prose${selected ? " cn-selected" : ""}`}
      {...spacingDataAttr(attrs.spacing)}
    >
      <div className="nac-container">
        <EditableText
          as="p"
          className="nac-eyebrow"
          value={String(attrs.eyebrow ?? "")}
          placeholder="Eyebrow"
          editable={editable}
          onChange={setEyebrow}
          onFocusHole={onFocusHole}
        />
        <div className="nac-logo-row">
          {logos.map((entry, index) => {
            const logo = (entry ?? {}) as { url?: unknown; mediaId?: unknown; alt?: unknown }
            const src = imageSource(logo)
            const alt = String(logo.alt ?? src.alt ?? "")
            return (
              <img
                // biome-ignore lint/suspicious/noArrayIndexKey: logos are positional; the same image may repeat so src is not unique
                key={index}
                className="nac-logo"
                src={sanitizeUrl(src.url, { allowDataImage: true })}
                alt={alt}
                data-media-id={src.id || undefined}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function LogoCloudLivingView({ node, updateAttributes, selected, getPos }: any) {
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
      <LogoCloudLiving
        attrs={node.attrs}
        selected={selected}
        setEyebrow={(value) => updateAttributes({ eyebrow: value })}
        onFocusHole={markSelected}
      />
    </NodeViewWrapper>
  )
}
