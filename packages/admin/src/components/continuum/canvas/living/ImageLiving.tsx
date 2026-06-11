import { sanitizeUrl } from "@not-a-cms/renderer/web"
import { NodeViewWrapper } from "@tiptap/react"
import { useCanvasSelection } from "../selection"

type Attrs = Record<string, unknown>

type LivingProps = {
  attrs: Attrs
  editable?: boolean
  selected?: boolean
}

export function ImageLiving({ attrs, editable = true, selected }: LivingProps) {
  const url = String(attrs.url ?? "")
  const alt = String(attrs.alt ?? "")
  const id = attrs.mediaId ? String(attrs.mediaId) : undefined

  if (editable && !url) {
    return (
      <div className={`cn-image-empty${selected ? " cn-selected" : ""}`}>
        Pick an image in the inspector
      </div>
    )
  }
  return (
    <img
      className={selected ? "cn-selected" : undefined}
      src={sanitizeUrl(url, { allowDataImage: true })}
      alt={alt}
      data-media-id={id}
    />
  )
}

export function ImageLivingView({ node, selected, getPos }: any) {
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
      <ImageLiving attrs={node.attrs} selected={selected} />
    </NodeViewWrapper>
  )
}
