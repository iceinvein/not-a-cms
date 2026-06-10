import { NodeViewWrapper } from "@tiptap/react"
import { imageSource, sanitizeUrl } from "@not-a-cms/renderer/web"
import { useCanvasSelection } from "../selection"

type Attrs = Record<string, unknown>

type LivingProps = {
  attrs: Attrs
  editable?: boolean
  selected?: boolean
}

export function GalleryLiving({ attrs, selected }: LivingProps) {
  const images = Array.isArray(attrs.images) ? attrs.images : []
  return (
    <div data-gallery="" className={selected ? "cn-selected" : undefined}>
      {images.map((entry, index) => {
        const image = imageSource(entry)
        return (
          <img
            // biome-ignore lint/suspicious/noArrayIndexKey: gallery entries are positional; the same image may repeat so src is not unique
            key={index}
            src={sanitizeUrl(image.url, { allowDataImage: true })}
            alt={image.alt ?? ""}
            data-media-id={image.id || undefined}
          />
        )
      })}
    </div>
  )
}

export function GalleryLivingView({ node, selected, getPos }: any) {
  const { select } = useCanvasSelection()
  const markSelected = () => {
    const pos = typeof getPos === "function" ? getPos() : null
    if (pos !== null && pos !== undefined) select({ pos, name: node.type.name })
  }
  return (
    <NodeViewWrapper className="cn-living" contentEditable={false} onPointerDownCapture={markSelected}>
      <GalleryLiving attrs={node.attrs} selected={selected} />
    </NodeViewWrapper>
  )
}
