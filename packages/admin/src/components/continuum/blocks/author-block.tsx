import { NodeViewWrapper } from "@tiptap/react"

export function AuthorBlockView({ node, updateAttributes }: any) {
  const name = String(node.attrs.name ?? "")
  const role = String(node.attrs.role ?? "")

  return (
    <NodeViewWrapper className="cn-block cn-author" contentEditable={false}>
      <input
        className="cn-block-input cn-author-name"
        value={name}
        placeholder="Author name"
        onChange={(event) => updateAttributes({ name: event.target.value })}
      />
      <input
        className="cn-block-input cn-author-role"
        value={role}
        placeholder="Role"
        onChange={(event) => updateAttributes({ role: event.target.value })}
      />
      <span className="cn-block-label">author</span>
    </NodeViewWrapper>
  )
}
