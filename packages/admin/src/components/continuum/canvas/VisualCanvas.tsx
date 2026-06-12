// packages/admin/src/components/continuum/canvas/VisualCanvas.tsx
// NOTE: the admin package resolves `@tiptap/react` but NOT `@tiptap/core` or
// `@tiptap/pm/state`, so we source the editor type from `@tiptap/react` and duck-type the
// node selection (a NodeSelection has a `.node`; text/all selections do not) instead of
// importing `NodeSelection`.

import type { CollabConfig, CollabPresenceUser, CursorState } from "@not-a-cms/editor"
import { Editor } from "@not-a-cms/editor"
import { renderSiteChrome, resolveSiteChrome } from "@not-a-cms/renderer/site-chrome"
import { brandCss, frameContainerCss, resolveActiveThemeCss } from "@not-a-cms/renderer/theme"
import type { Editor as TiptapEditor } from "@tiptap/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { continuumSlashCommands } from "../blocks"
import { Breadcrumb } from "./Breadcrumb"
import { CanvasChrome } from "./CanvasChrome"
import { CanvasOverlay } from "./CanvasOverlay"
import { Inspector } from "./Inspector"
import { livingBlocks } from "./living-blocks"
import { PresenceAvatars } from "./PresenceAvatars"
import { StructureTree } from "./StructureTree"
import { scopeThemeVariables } from "./scope-theme"
import { type CanvasSelection, CanvasSelectionContext } from "./selection"
import { type FrameWidth, WidthSelector } from "./WidthSelector"

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
 * rendered as a brand-styled page with inline-editable living views, a left-rail structure
 * tree, a hover/selection overlay, an ancestry breadcrumb, and a right-rail inspector. The
 * theme and the read-only site chrome (header/footer) are fetched together from /api/_site;
 * theme variables are scoped to `.cn-visual` and brandCss is class-scoped. The editable body
 * sits inside a responsive `.cn-visual-frame` (container-query driven) with the real chrome.
 */
export function VisualCanvas({ content, onChange, apiBase = "", collaboration }: Props) {
  const [theme, setTheme] = useState(() => resolveActiveThemeCss(null))
  const [chrome, setChrome] = useState<{ header: string; footer: string }>({
    header: "",
    footer: "",
  })
  const [width, setWidth] = useState<FrameWidth>("desktop")
  const [selected, setSelected] = useState<CanvasSelection>(null)
  const [editor, setEditor] = useState<TiptapEditor | null>(null)
  const [collaborators, setCollaborators] = useState<CollabPresenceUser[]>([])
  const [remoteCursors, setRemoteCursors] = useState<CursorState[]>([])
  // Bumped on every transaction so the tree/breadcrumb re-read the live doc and selection.
  const [, setRevision] = useState(0)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    fetch(`${apiBase}/api/_site`)
      .then((res) => (res.ok ? res.json() : null))
      .then((apiSite) => {
        if (!active) return
        setTheme(resolveActiveThemeCss(apiSite?.theme ?? null))
        setChrome(renderSiteChrome(resolveSiteChrome(apiSite)))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [apiBase])

  // Keep the rail in sync with ProseMirror's own selection (e.g. clicking a section's chrome
  // creates a NodeSelection). Duck-type the NodeSelection by its `.node` property (the admin
  // package cannot resolve `@tiptap/pm/state`). NOTE: we only ever SET here, never clear, so
  // that clicking into a living block's inline text (a TextSelection inside the node) does not
  // close the inspector mid-edit. The tree/breadcrumb track the caret independently via
  // activeBlockPos, so prose navigation does not depend on this. This matches Phase 2 exactly.
  const syncFromEditor = useCallback((ed: TiptapEditor) => {
    const sel = ed.state.selection as { from: number; node?: { type: { name: string } } }
    if (sel.node && LIVING_NAMES.has(sel.node.type.name)) {
      setSelected({ pos: sel.from, name: sel.node.type.name })
    }
  }, [])

  const handleReady = useCallback((ed: TiptapEditor) => setEditor(ed), [])

  // Subscribe to the live editor for chrome reactivity: `selectionUpdate` keeps the inspector
  // selection in sync, and the revision bump on every transaction re-renders so the tree and
  // breadcrumb re-read the current doc/selection. Registered in an effect (not in onReady) so
  // React tears the listeners down if the editor is ever recreated, with no leak or doubles.
  useEffect(() => {
    if (!editor) return
    const onSelection = () => syncFromEditor(editor)
    const onTransaction = () => setRevision((r) => r + 1)
    editor.on("selectionUpdate", onSelection)
    editor.on("transaction", onTransaction)
    return () => {
      editor.off("selectionUpdate", onSelection)
      editor.off("transaction", onTransaction)
    }
  }, [editor, syncFromEditor])

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
        <style>{frameContainerCss}</style>
        {theme.fontImport ? <link rel="stylesheet" href={theme.fontImport} /> : null}
        {/* Full-width strip above the three-column layout. */}
        <div className="cn-visual-topstrip">
          <Breadcrumb editor={editor} />
          <div className="cn-visual-topstrip-right">
            <PresenceAvatars users={collaborators} />
            <WidthSelector value={width} onChange={setWidth} />
          </div>
        </div>
        <div className="cn-visual-layout">
          <StructureTree editor={editor} />
          <div className="cn-visual-stage" ref={stageRef}>
            <div className="cn-visual-frame" data-width={width}>
              <CanvasChrome header={chrome.header} footer={chrome.footer}>
                <article className="cn-visual-page prose">
                  <Editor
                    content={content}
                    blocks={livingBlocks}
                    slashCommands={continuumSlashCommands}
                    placeholder="Type / to insert a section, or just start writing..."
                    collaboration={collaboration}
                    presence="headless"
                    onPresenceChange={setCollaborators}
                    onRemoteCursorsChange={setRemoteCursors}
                    onChange={onChange}
                    onReady={handleReady}
                  />
                </article>
              </CanvasChrome>
            </div>
            <CanvasOverlay editor={editor} containerRef={stageRef} cursors={remoteCursors} />
          </div>
          <Inspector editor={editor} selected={selected} apiBase={apiBase} />
        </div>
      </div>
    </CanvasSelectionContext.Provider>
  )
}
