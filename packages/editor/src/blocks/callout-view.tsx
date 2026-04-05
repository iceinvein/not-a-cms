import { NodeViewWrapper, NodeViewContent } from "@tiptap/react"

const VARIANT_STYLES: Record<string, { icon: string; bg: string }> = {
  info: { icon: "ℹ️", bg: "#e3f2fd" },
  warning: { icon: "⚠️", bg: "#fff3e0" },
  success: { icon: "✅", bg: "#e8f5e9" },
  error: { icon: "🚨", bg: "#ffebee" },
}

export function CalloutView({ node, updateAttributes }: any) {
  const variant = node.attrs.variant || "info"
  const style = VARIANT_STYLES[variant] || VARIANT_STYLES.info

  return (
    <NodeViewWrapper
      data-callout=""
      data-variant={variant}
      style={{ background: style.bg, padding: "12px 16px", borderRadius: "6px", margin: "8px 0" }}
    >
      <div contentEditable={false} style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
        <span>{style.icon}</span>
        <select
          value={variant}
          onChange={(e) => updateAttributes({ variant: e.target.value })}
          style={{ fontSize: "12px", border: "none", background: "transparent" }}
        >
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
        </select>
      </div>
      <NodeViewContent style={{ outline: "none" }} />
    </NodeViewWrapper>
  )
}
