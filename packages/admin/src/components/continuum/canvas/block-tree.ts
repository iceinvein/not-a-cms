// packages/admin/src/components/continuum/canvas/block-tree.ts
import { blockSpecs } from "../blocks/specs"

export type BlockTreeNode = {
  /** Position directly before the node (the value `setNodeSelection` expects). */
  pos: number
  name: string
  label: string
  /** "sections" | "fields" for spec blocks, "prose" for everything else. */
  group: string
  /** ProseMirror nodeSize, so callers can test whether a selection falls inside this block. */
  size: number
}

type NodeLike = { type: { name: string }; attrs?: Record<string, unknown> }
type DocLike = { forEach: (fn: (node: any, offset: number, index: number) => void) => void }

const SPEC_BY_NAME = new Map(blockSpecs.map((s) => [s.name, s] as const))

/** Friendly labels for the prose (non-block-spec) node types Continuum can hold. */
const PROSE_LABELS: Record<string, string> = {
  paragraph: "Paragraph",
  bulletList: "List",
  orderedList: "List",
  blockquote: "Quote",
  codeBlock: "Code",
  callout: "Callout",
  horizontalRule: "Divider",
}

export function labelForNode(node: NodeLike): string {
  const spec = SPEC_BY_NAME.get(node.type.name)
  if (spec) return spec.label
  if (node.type.name === "heading") {
    // `|| 1` coerces a missing or non-numeric level (NaN) to 1, not just a nullish attrs object.
    const level = Number(node.attrs?.level) || 1
    return `Heading ${level}`
  }
  return PROSE_LABELS[node.type.name] ?? node.type.name
}

export function groupForNode(node: NodeLike): string {
  return SPEC_BY_NAME.get(node.type.name)?.group ?? "prose"
}

/** Ordered list of the document's top-level blocks. The single source of truth for the
 * structure tree, overlay, and breadcrumb. */
export function topLevelBlocks(doc: DocLike): BlockTreeNode[] {
  const blocks: BlockTreeNode[] = []
  doc.forEach((node, offset) => {
    blocks.push({
      pos: offset,
      name: node.type.name,
      label: labelForNode(node),
      group: groupForNode(node),
      size: Number(node.nodeSize ?? 1),
    })
  })
  return blocks
}

/** The pos of the top-level block whose range [pos, pos+size) contains `from`, or null. */
export function activeBlockPos(blocks: BlockTreeNode[], from: number): number | null {
  for (const b of blocks) {
    if (from >= b.pos && from < b.pos + b.size) return b.pos
  }
  return null
}

/** ProseMirror position of gap `gapIndex` (0..blocks.length): the start of the block at that
 *  index, or the end of the last block for the trailing gap. Returns 0 for an empty list. */
export function gapPosition(blocks: BlockTreeNode[], gapIndex: number): number {
  if (blocks.length === 0) return 0
  if (gapIndex >= blocks.length) {
    const last = blocks[blocks.length - 1]
    return last.pos + last.size
  }
  return blocks[Math.max(0, gapIndex)].pos
}

export type MovePlan = { delFrom: number; delTo: number; insertPos: number }

/**
 * Compute the delete range and post-deletion insert position to move the block at `fromIndex`
 * into gap `toGapIndex` (0..blocks.length). Returns null for a no-op: moving into the block's
 * own slot (`toGapIndex === fromIndex`) or the gap immediately after it (`fromIndex + 1`).
 * When the target gap is after the source, the insert position is shifted left by the source's
 * size because deleting the source first removes that many positions ahead of the target.
 */
export function planMove(
  blocks: BlockTreeNode[],
  fromIndex: number,
  toGapIndex: number,
): MovePlan | null {
  const source = blocks[fromIndex]
  if (!source) return null
  if (toGapIndex === fromIndex || toGapIndex === fromIndex + 1) return null
  const delFrom = source.pos
  const delTo = source.pos + source.size
  const gapPos = gapPosition(blocks, toGapIndex)
  const insertPos = gapPos > source.pos ? gapPos - source.size : gapPos
  return { delFrom, delTo, insertPos }
}
