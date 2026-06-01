import { useEditor, EditorContent } from "@tiptap/react"
import { useEffect, useRef } from "react"
import StarterKit from "@tiptap/starter-kit"
import Typography from "@tiptap/extension-typography"
import { Placeholder } from "@tiptap/extensions"
import { DEFAULT_COMMANDS, SlashExtension, type SlashCommandItem } from "./extensions/slash-command"
import { CalloutExtension } from "./blocks/callout"
import type { DefinedBlock } from "./blocks"
import { BubbleToolbar } from "./menus/bubble-menu"
import { toPortableText } from "./portable-text/to-portable-text"
import { fromPortableText } from "./portable-text/from-portable-text"
import { useCollaboration, type CollabConfig } from "./collaboration/provider"
import type { Extension } from "@tiptap/core"

type PortableTextBlock = { type: string; [key: string]: any }

export type EditorProps = {
  content?: PortableTextBlock[]
  onChange?: (content: PortableTextBlock[]) => void
  placeholder?: string
  editable?: boolean
  collaboration?: CollabConfig
  extensions?: Extension[]
  blocks?: DefinedBlock[]
  slashCommands?: SlashCommandItem[]
}

export function Editor({
  content,
  onChange,
  placeholder = "Type / to insert, or just start writing...",
  editable = true,
  collaboration,
  extensions: extraExtensions = [],
  blocks = [],
  slashCommands = [],
}: EditorProps) {
  const collab = useCollaboration(collaboration)
  const initialContentSignature = content ? portableTextSignature(content) : null
  const appliedContentSignature = useRef<string | null>(initialContentSignature)
  const hasAppliedInitialContent = useRef(Boolean(initialContentSignature) && !collaboration)

  // Build initial content from Portable Text
  const initialContent = content ? fromPortableText(content) : undefined

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable undo/redo history when using collaboration (Y.js handles it)
        ...(collaboration ? { undoRedo: false } : {}),
      }),
      Typography,
      Placeholder.configure({ placeholder }),
      SlashExtension.configure({ commands: [...DEFAULT_COMMANDS, ...slashCommands] }),
      CalloutExtension,
      ...blocks.map((block) => block.extension),
      ...collab.extensions,
      ...extraExtensions,
    ],
    content: initialContent,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      if (onChange) {
        const json = editor.getJSON()
        const pt = toPortableText(json as any)
        onChange(pt)
      }
    },
  })

  useEffect(() => {
    if (!editor || !content) return
    const nextSignature = portableTextSignature(content)
    if (appliedContentSignature.current === nextSignature) return
    if (hasAppliedInitialContent.current) return

    editor.commands.setContent(fromPortableText(content), { emitUpdate: false })
    appliedContentSignature.current = nextSignature
    hasAppliedInitialContent.current = true
  }, [editor, content])

  if (!editor) return null

  return (
    <div className="not-a-cms-editor" style={{ position: "relative" }}>
      {collaboration && collab.users.length > 0 && (
        <div
          className="not-a-cms-collaborators"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.5rem 1rem 0",
            fontSize: "0.75rem",
            color: "#a1a1aa",
          }}
        >
          {collab.users.map(({ clientId, user }) => (
            <span
              key={clientId}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: "0.5rem",
                  height: "0.5rem",
                  borderRadius: "999px",
                  background: user.color,
                }}
              />
              {user.name}
            </span>
          ))}
        </div>
      )}
      {editable && <BubbleToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  )
}

function portableTextSignature(content: PortableTextBlock[]): string {
  return JSON.stringify(content)
}
