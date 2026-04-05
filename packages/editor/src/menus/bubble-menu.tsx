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
    fontWeight: active ? 700 : 400,
    background: active ? "#e2e8f0" : "transparent",
    fontSize: "14px",
  })

  return (
    <div style={{
      display: "flex",
      gap: "2px",
      background: "white",
      border: "1px solid #e2e8f0",
      borderRadius: "8px",
      padding: "4px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
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
      <div style={{ width: "1px", background: "#e2e8f0", margin: "0 4px" }} />
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
