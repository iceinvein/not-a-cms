// packages/admin/src/components/continuum/canvas/canvas-ops.ts
import { type BlockTreeNode, planMove } from "./block-tree"

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

/** A chain builder covering the commands the mutation appliers use. */
type CanvasChain = {
  focus: () => CanvasChain
  deleteRange: (range: { from: number; to: number }) => CanvasChain
  insertContentAt: (pos: number, content: unknown) => CanvasChain
  run: () => boolean
}

/** The editor surface mutations need, on top of CanvasEditor. The real Tiptap editor satisfies it. */
export type MutationEditor = CanvasEditor & {
  state: { doc: { nodeAt: (pos: number) => { toJSON: () => unknown } | null } }
  chain: () => CanvasChain
}

/** Insert a bare block of `type` (schema defaults apply) at `pos`, as one transaction. */
export function insertBlockAt(editor: MutationEditor, pos: number, type: string): void {
  editor.chain().insertContentAt(pos, { type }).run()
}

/**
 * Move the top-level block at `fromIndex` into gap `toGapIndex` as a single transaction: read
 * the source node's JSON, delete its range, then re-insert the JSON at the mapped position.
 * Returns false (no chain dispatched) for a no-op move or when the source node cannot be read.
 * Chain commands apply sequentially against the evolving transaction doc, so `insertPos` (which
 * planMove already mapped past the deletion) is correct in the post-delete doc.
 */
export function moveBlock(
  editor: MutationEditor,
  blocks: BlockTreeNode[],
  fromIndex: number,
  toGapIndex: number,
): boolean {
  const plan = planMove(blocks, fromIndex, toGapIndex)
  if (!plan) return false
  const node = editor.state.doc.nodeAt(plan.delFrom)
  if (!node) return false
  const json = node.toJSON()
  editor
    .chain()
    .deleteRange({ from: plan.delFrom, to: plan.delTo })
    .insertContentAt(plan.insertPos, json)
    .run()
  return true
}
