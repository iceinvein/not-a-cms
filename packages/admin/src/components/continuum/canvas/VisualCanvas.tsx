// packages/admin/src/components/continuum/canvas/VisualCanvas.tsx
// NOTE: the admin package resolves `@tiptap/react` but NOT `@tiptap/core` or
// `@tiptap/pm/state`, so we source the editor type from `@tiptap/react` and duck-type the
// node selection (a NodeSelection has a `.node`; text/all selections do not) instead of
// importing `NodeSelection`.
import type { Editor as TiptapEditor } from "@tiptap/react"
import type { CollabConfig } from "@not-a-cms/editor"
import { Editor } from "@not-a-cms/editor"
import { brandCss, resolveActiveThemeCss } from "@not-a-cms/renderer/theme"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { continuumSlashCommands } from "../blocks"
import { Inspector } from "./Inspector"
import { livingBlocks } from "./living-blocks"
import { scopeThemeVariables } from "./scope-theme"
import { CanvasSelectionContext, type CanvasSelection } from "./selection"

type PortableTextBlock = { type: string; [key: string]: unknown }

type Props = {
  content?: PortableTextBlock[]
  onChange?: (blocks: PortableTextBlock[]) => void
  apiBase?: string
  collaboration?: CollabConfig
}

const LIVING_NAMES = new Set(livingBlocks.map((b) => b.name))

/**
 * Visual editing canvas: the same Tiptap Editor and Portable Text body as Document mode,
 * rendered as a brand-styled page with inline-editable living views and a right-rail
 * inspector. Theme variables are fetched from /api/_theme and scoped to `.cn-visual` so
 * they cannot leak into the admin shell; brandCss is class-scoped already.
 */
export function VisualCanvas({ content, onChange, apiBase = "", collaboration }: Props) {
  const [theme, setTheme] = useState(() => resolveActiveThemeCss(null))
  const [selected, setSelected] = useState<CanvasSelection>(null)
  const editorRef = useRef<TiptapEditor | null>(null)

  useEffect(() => {
    let active = true
    fetch(`${apiBase}/api/_theme`)
      .then((res) => (res.ok ? res.json() : null))
      .then((apiTheme) => {
        if (active) setTheme(resolveActiveThemeCss(apiTheme))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [apiBase])

  // Keep the rail in sync with ProseMirror's own selection (e.g. clicking a section's
  // chrome creates a NodeSelection); clear it when selection leaves a living block.
  // Duck-type the NodeSelection by its `.node` property rather than importing the class
  // (the admin package cannot resolve `@tiptap/pm/state`).
  const syncFromEditor = useCallback((editor: TiptapEditor) => {
    const sel = editor.state.selection as { from: number; node?: { type: { name: string } } }
    if (sel.node && LIVING_NAMES.has(sel.node.type.name)) {
      setSelected({ pos: sel.from, name: sel.node.type.name })
    }
  }, [])

  const handleReady = useCallback(
    (editor: TiptapEditor) => {
      editorRef.current = editor
      editor.on("selectionUpdate", () => syncFromEditor(editor))
    },
    [syncFromEditor],
  )

  const selectionValue = useMemo(
    () => ({
      selected,
      select: (next: { pos: number; name: string }) => setSelected(next),
      clear: () => setSelected(null),
    }),
    [selected],
  )

  const scopedVariables = scopeThemeVariables(theme.variables, ".cn-visual")

  return (
    <CanvasSelectionContext.Provider value={selectionValue}>
      <div className="cn-visual">
        <style>{scopedVariables}</style>
        <style>{brandCss}</style>
        {theme.fontImport ? <link rel="stylesheet" href={theme.fontImport} /> : null}
        <div className="cn-visual-layout">
          <article className="cn-visual-page prose">
            <Editor
              content={content}
              blocks={livingBlocks}
              slashCommands={continuumSlashCommands}
              placeholder="Type / to insert a section, or just start writing..."
              collaboration={collaboration}
              onChange={onChange}
              onReady={handleReady}
            />
          </article>
          <Inspector editor={editorRef.current} selected={selected} apiBase={apiBase} />
        </div>
      </div>
    </CanvasSelectionContext.Provider>
  )
}
