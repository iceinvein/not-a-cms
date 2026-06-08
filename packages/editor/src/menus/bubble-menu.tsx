import type { Editor } from "@tiptap/core"

type BubbleToolbarProps = {
  editor: Editor
}

function LinkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

export function BubbleToolbar({ editor }: BubbleToolbarProps) {
  if (!editor) return null

  const cls = (active: boolean) => `cn-bubble-btn${active ? " cn-bubble-btn-on" : ""}`

  return (
    <div className="cn-bubble">
      <button
        type="button"
        className={cls(editor.isActive("bold"))}
        aria-label="Bold"
        aria-pressed={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <b>B</b>
      </button>
      <button
        type="button"
        className={cls(editor.isActive("italic"))}
        aria-label="Italic"
        aria-pressed={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <i>I</i>
      </button>
      <button
        type="button"
        className={cls(editor.isActive("code"))}
        aria-label="Inline code"
        aria-pressed={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <span className="cn-bubble-mono">{"</>"}</span>
      </button>
      <button
        type="button"
        className={cls(editor.isActive("link"))}
        aria-label="Add link"
        aria-pressed={editor.isActive("link")}
        onClick={() => {
          const href = window.prompt("URL:")
          if (href) {
            editor.chain().focus().setLink({ href }).run()
          }
        }}
      >
        <LinkIcon />
      </button>
      <span className="cn-bubble-sep" aria-hidden="true" />
      <button
        type="button"
        className={cls(editor.isActive("heading", { level: 1 }))}
        aria-label="Heading 1"
        aria-pressed={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().setHeading({ level: 1 }).run()}
      >
        <span className="cn-bubble-mono">H1</span>
      </button>
      <button
        type="button"
        className={cls(editor.isActive("heading", { level: 2 }))}
        aria-label="Heading 2"
        aria-pressed={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().setHeading({ level: 2 }).run()}
      >
        <span className="cn-bubble-mono">H2</span>
      </button>
    </div>
  )
}
