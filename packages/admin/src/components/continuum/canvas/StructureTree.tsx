// packages/admin/src/components/continuum/canvas/StructureTree.tsx
import type { Editor as TiptapEditor } from "@tiptap/react"
import { activeBlockPos, topLevelBlocks } from "./block-tree"
import { scrollBlockIntoView, selectBlockAt } from "./canvas-ops"

type Props = { editor: TiptapEditor | null }

/**
 * Flat left-rail list of the document's top-level blocks. Clicking a row selects the block
 * (a NodeSelection, which the inspector and overlay react to) and scrolls it into view. The
 * active row is the block containing the current selection. Reorder is added in Phase 3B.
 */
export function StructureTree({ editor }: Props) {
  const blocks = editor ? topLevelBlocks(editor.state.doc) : []
  if (!editor || blocks.length === 0) {
    return (
      <nav className="cn-tree" aria-label="Document structure">
        <p className="cn-tree-empty">No blocks yet.</p>
      </nav>
    )
  }
  const active = activeBlockPos(blocks, editor.state.selection.from)
  return (
    <nav className="cn-tree" aria-label="Document structure">
      <ol className="cn-tree-list">
        {blocks.map((b) => (
          <li key={b.pos}>
            <button
              type="button"
              className={`cn-tree-row${active === b.pos ? " cn-tree-active" : ""}`}
              data-pos={b.pos}
              data-group={b.group}
              aria-current={active === b.pos ? "true" : undefined}
              onClick={() => {
                selectBlockAt(editor, b.pos)
                scrollBlockIntoView(editor, b.pos)
              }}
            >
              <span className="cn-tree-dot" data-group={b.group} aria-hidden="true" />
              <span className="cn-tree-label">{b.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}
