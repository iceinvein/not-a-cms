import { NodeViewWrapper } from "@tiptap/react"

export function SeoBlockView({ node, updateAttributes }: any) {
  const metaTitle = String(node.attrs.metaTitle ?? "")
  const metaDescription = String(node.attrs.metaDescription ?? "")

  return (
    <NodeViewWrapper className="cn-block cn-seo" contentEditable={false}>
      <input
        className="cn-block-input"
        value={metaTitle}
        placeholder="Meta title"
        onChange={(event) => updateAttributes({ metaTitle: event.target.value })}
      />
      <textarea
        className="cn-block-input cn-block-textarea"
        value={metaDescription}
        placeholder="Meta description"
        onChange={(event) => updateAttributes({ metaDescription: event.target.value })}
      />
      <span className="cn-block-label">SEO</span>
    </NodeViewWrapper>
  )
}
