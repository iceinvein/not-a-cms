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
