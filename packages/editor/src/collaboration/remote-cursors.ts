import { type Editor, Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view"
import { readableTextColor, safeCssColor } from "./color"
import type { CursorState } from "./provider"

type RemoteCursorsOptions = {
  cursors: CursorState[]
  throttleMs: number
  onLocalSelection: (anchor: number, head: number) => void
}

const remoteCursorsPluginKey = new PluginKey<CursorState[]>("remoteCursors")

export const RemoteCursors = Extension.create<RemoteCursorsOptions>({
  name: "remoteCursors",

  addOptions() {
    return {
      cursors: [],
      throttleMs: 80,
      onLocalSelection: () => {},
    }
  },

  addProseMirrorPlugins() {
    const extension = this

    return [
      new Plugin<CursorState[]>({
        key: remoteCursorsPluginKey,
        state: {
          init: () => extension.options.cursors,
          apply(transaction, value) {
            const cursors = transaction.getMeta(remoteCursorsPluginKey) as CursorState[] | undefined
            return Array.isArray(cursors) ? cursors : value
          },
        },
        props: {
          decorations(state) {
            const cursors = remoteCursorsPluginKey.getState(state) ?? []
            const decorations = cursors.flatMap((cursor) =>
              cursorDecorations(cursor, state.doc.content.size),
            )
            return DecorationSet.create(state.doc, decorations)
          },
        },
        view(view) {
          return createSelectionEmitter(view, extension.options)
        },
      }),
    ]
  },
})

export function setRemoteCursors(editor: Editor, cursors: CursorState[]): void {
  editor.view.dispatch(editor.state.tr.setMeta(remoteCursorsPluginKey, cursors))
}

function cursorDecorations(cursor: CursorState, documentSize: number): Decoration[] {
  const color = safeCssColor(cursor.user.color)
  const anchor = clampPosition(cursor.anchor, documentSize)
  const head = clampPosition(cursor.head, documentSize)
  const from = Math.min(anchor, head)
  const to = Math.max(anchor, head)
  const decorations: Decoration[] = []

  if (from < to) {
    decorations.push(
      Decoration.inline(from, to, {
        class: "nacms-remote-selection",
        style: `background: color-mix(in srgb, ${color} 24%, transparent);`,
      }),
    )
  }

  decorations.push(
    Decoration.widget(head, () => createCaretElement(cursor.user.name, color), {
      key: `cursor-${cursor.clientId}`,
      side: -1,
    }),
  )

  return decorations
}

function createCaretElement(name: string, color: string): HTMLElement {
  const caret = document.createElement("span")
  caret.className = "nacms-remote-caret"
  caret.style.setProperty("--nacms-cursor-color", color)

  const label = document.createElement("span")
  label.className = "nacms-remote-caret-label"
  label.style.background = color
  label.style.color = readableTextColor(color)
  label.textContent = name

  caret.append(label)
  return caret
}

function createSelectionEmitter(view: EditorView, options: RemoteCursorsOptions) {
  let lastAnchor = view.state.selection.anchor
  let lastHead = view.state.selection.head
  let lastSentAt = 0
  let timeout: ReturnType<typeof setTimeout> | null = null

  const emit = () => {
    timeout = null
    const { anchor, head } = view.state.selection
    lastAnchor = anchor
    lastHead = head
    lastSentAt = Date.now()
    options.onLocalSelection(anchor, head)
  }

  const schedule = () => {
    const { anchor, head } = view.state.selection
    if (anchor === lastAnchor && head === lastHead) return

    const wait = options.throttleMs - (Date.now() - lastSentAt)
    if (wait <= 0) {
      if (timeout) clearTimeout(timeout)
      emit()
      return
    }

    if (!timeout) {
      timeout = setTimeout(emit, wait)
    }
  }

  return {
    update: schedule,
    destroy() {
      if (timeout) clearTimeout(timeout)
    },
  }
}

function clampPosition(position: number, documentSize: number): number {
  return Math.max(0, Math.min(position, documentSize))
}
