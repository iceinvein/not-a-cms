import { NodeViewWrapper } from "@tiptap/react"
import { useCanvasSelection } from "../selection"

type Attrs = Record<string, unknown>

type LivingProps = {
  attrs: Attrs
  editable?: boolean
  selected?: boolean
}

/**
 * SEO renders nothing on the public page, so on the canvas it shows a chip (in editable
 * mode) that authors can click to select the block and edit its meta fields in the
 * inspector. In static mode it renders nothing, matching the empty production output.
 */
export function SeoLiving({ editable = true, selected }: LivingProps) {
  if (!editable) return null
  return (
    <div className={`cn-seo-chip${selected ? " cn-selected" : ""}`} contentEditable={false}>
      SEO &amp; meta: edit in the inspector
    </div>
  )
}

export function SeoLivingView({ node, selected, getPos }: any) {
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
      <SeoLiving attrs={node.attrs} selected={selected} />
    </NodeViewWrapper>
  )
}
