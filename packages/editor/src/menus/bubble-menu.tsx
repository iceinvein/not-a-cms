import type { Editor } from "@tiptap/core"

type BubbleToolbarProps = {
  editor: Editor
}

export function BubbleToolbar({ editor }: BubbleToolbarProps) {
  if (!editor) return null

  const btnStyle = (active: boolean) => ({
    padding: "4px 8px",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontWeight: active ? 600 : 400,
    background: active ? "rgba(255,255,255,0.1)" : "transparent",
    color: active ? "#fafafa" : "#a1a1aa",
    fontSize: "13px",
  })

  return (
    <div style={{
      display: "flex",
      gap: "2px",
      background: "#18181b",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "8px",
      padding: "4px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
    }}>
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        style={btnStyle(editor.isActive("bold"))}
      >
        B
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        style={btnStyle(editor.isActive("italic"))}
      >
        I
      </button>
      <button
        onClick={() => editor.chain().focus().toggleCode().run()}
        style={btnStyle(editor.isActive("code"))}
      >
        {"</>"}
      </button>
      <button
        onClick={() => {
          const href = window.prompt("URL:")
          if (href) {
            editor.chain().focus().setLink({ href }).run()
          }
        }}
        style={btnStyle(editor.isActive("link"))}
      >
        🔗
      </button>
      <div style={{ width: "1px", background: "rgba(255,255,255,0.08)", margin: "0 4px" }} />
      <button
        onClick={() => editor.chain().focus().setHeading({ level: 1 }).run()}
        style={btnStyle(editor.isActive("heading", { level: 1 }))}
      >
        H1
      </button>
      <button
        onClick={() => editor.chain().focus().setHeading({ level: 2 }).run()}
        style={btnStyle(editor.isActive("heading", { level: 2 }))}
      >
        H2
      </button>
    </div>
  )
}
