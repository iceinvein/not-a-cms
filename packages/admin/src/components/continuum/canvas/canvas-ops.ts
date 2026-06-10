// packages/admin/src/components/continuum/canvas/canvas-ops.ts

/** Minimal editor surface the canvas chrome needs. The admin package cannot import
 *  @tiptap/pm types, so this duck-types the command/view API instead. */
export type CanvasEditor = {
  commands: { setNodeSelection: (pos: number) => boolean }
  view?: { nodeDOM: (pos: number) => unknown }
}

/**
 * Select the top-level block at `pos` as a ProseMirror NodeSelection. This flows through
 * VisualCanvas's existing `selectionUpdate` handler, so the inspector, breadcrumb, and
 * overlay selection outline all update from one source of truth.
 */
export function selectBlockAt(editor: CanvasEditor, pos: number): void {
  editor.commands.setNodeSelection(pos)
}

/** Scroll the DOM for the block at `pos` into view (no-op when layout is unavailable). */
export function scrollBlockIntoView(editor: CanvasEditor, pos: number): void {
  const dom = editor.view?.nodeDOM(pos) as {
    scrollIntoView?: (opts?: ScrollIntoViewOptions) => void
  } | null
  dom?.scrollIntoView?.({ block: "nearest" })
}
