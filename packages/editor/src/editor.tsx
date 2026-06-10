import type { Extension } from "@tiptap/core"
import Typography from "@tiptap/extension-typography"
import { Placeholder } from "@tiptap/extensions"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { useEffect, useMemo, useRef } from "react"
import type { DefinedBlock } from "./blocks"
import { CalloutExtension } from "./blocks/callout"
import { type CollabConfig, useCollaboration } from "./collaboration/provider"
import { RemoteCursors, setRemoteCursors } from "./collaboration/remote-cursors"
import { DEFAULT_COMMANDS, type SlashCommandItem, SlashExtension } from "./extensions/slash-command"
import { BubbleToolbar } from "./menus/bubble-menu"
import { fromPortableText } from "./portable-text/from-portable-text"
import { toPortableText } from "./portable-text/to-portable-text"

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
  /** Called once with the Tiptap editor instance after creation (for selection/attr access). */
  onReady?: (editor: NonNullable<ReturnType<typeof useEditor>>) => void
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
  onReady,
}: EditorProps) {
  const collab = useCollaboration(collaboration)
  const collabProviderRef = useRef(collab.provider)
  const initialContentSignature = content ? portableTextSignature(content) : null
  const appliedContentSignature = useRef<string | null>(initialContentSignature)
  const hasAppliedInitialContent = useRef(Boolean(initialContentSignature) && !collaboration)
  // biome-ignore lint/correctness/useExhaustiveDependencies: deliberately keyed on collaboration's truthiness only; depending on the collaboration object identity would rebuild the extensions array and tear down/recreate the Tiptap editor
  const remoteCursorExtensions = useMemo(
    () =>
      collaboration
        ? [
            RemoteCursors.configure({
              onLocalSelection: (anchor, head) =>
                collabProviderRef.current?.sendCursor(anchor, head),
            }),
          ]
        : [],
    [Boolean(collaboration)],
  )

  // Build initial content from Portable Text
  const initialContent = content ? fromPortableText(content) : undefined

  useEffect(() => {
    collabProviderRef.current = collab.provider
  }, [collab.provider])

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
      ...remoteCursorExtensions,
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on collaboration's truthiness plus the live cursor map; the collaboration object identity is intentionally not a trigger
  useEffect(() => {
    if (!editor || !collaboration) return
    setRemoteCursors(editor, collab.cursors)
  }, [editor, Boolean(collaboration), collab.cursors])

  useEffect(() => {
    if (editor && onReady) onReady(editor)
  }, [editor, onReady])

  if (!editor) return null

  return (
    <div className="not-a-cms-editor" style={{ position: "relative" }}>
      <style>{remoteCursorStyles}</style>
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

const remoteCursorStyles = `
.not-a-cms-editor .ProseMirror {
  position: relative;
}

.nacms-remote-caret {
  position: relative;
  display: inline-block;
  width: 0;
  height: 1.15em;
  margin-left: -1px;
  border-left: 2px solid var(--nacms-cursor-color, #38bdf8);
  vertical-align: text-bottom;
  pointer-events: none;
  z-index: 3;
}

.nacms-remote-caret-label {
  position: absolute;
  top: -1.45rem;
  left: -2px;
  max-width: 12rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-size: 0.7rem;
  line-height: 1.15;
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.28);
}

.nacms-remote-selection {
  border-radius: 2px;
}
`
