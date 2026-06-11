// packages/admin/src/components/continuum/canvas/StructureTree.tsx
import type { Editor as TiptapEditor } from "@tiptap/react"
import type React from "react"
import { useRef, useState } from "react"
import { activeBlockPos, topLevelBlocks } from "./block-tree"
import { moveBlock, scrollBlockIntoView, selectBlockAt } from "./canvas-ops"

type Props = { editor: TiptapEditor | null }

/**
 * Flat left-rail list of the document's top-level blocks. Clicking a row selects the block (a
 * NodeSelection the inspector and overlay react to) and scrolls it into view; the active row is
 * the block containing the current selection. Rows are draggable (HTML5 DnD): dropping a row on
 * the top or bottom half of another row reorders the document via the same moveBlock as the
 * canvas drag handle.
 */
export function StructureTree({ editor }: Props) {
  const blocks = editor ? topLevelBlocks(editor.state.doc) : []
  const dragFrom = useRef<number | null>(null)
  const [dropGap, setDropGap] = useState<number | null>(null)

  if (!editor || blocks.length === 0) {
    return (
      <nav className="cn-tree" aria-label="Document structure">
        <p className="cn-tree-empty">No blocks yet.</p>
      </nav>
    )
  }
  const active = activeBlockPos(blocks, editor.state.selection.from)

  // The gap a drop on row `index` targets: top half inserts before it, bottom half after it.
  const gapForRowEvent = (index: number, e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const after = e.clientY - rect.top > rect.height / 2
    return after ? index + 1 : index
  }

  return (
    <nav className="cn-tree" aria-label="Document structure">
      <ol className="cn-tree-list">
        {blocks.map((b, index) => (
          <li key={b.pos}>
            <button
              type="button"
              draggable
              className={`cn-tree-row${active === b.pos ? " cn-tree-active" : ""}${dropGap === index ? " cn-tree-drop-before" : ""}${dropGap === index + 1 ? " cn-tree-drop-after" : ""}`}
              data-pos={b.pos}
              data-index={index}
              data-group={b.group}
              aria-current={active === b.pos ? "true" : undefined}
              onClick={() => {
                selectBlockAt(editor, b.pos)
                scrollBlockIntoView(editor, b.pos)
              }}
              onDragStart={() => {
                dragFrom.current = index
              }}
              onDragOver={(e) => {
                if (dragFrom.current === null) return
                e.preventDefault()
                setDropGap(gapForRowEvent(index, e))
              }}
              onDrop={(e) => {
                e.preventDefault()
                const from = dragFrom.current
                const gap = gapForRowEvent(index, e)
                dragFrom.current = null
                setDropGap(null)
                if (from !== null) moveBlock(editor as never, blocks, from, gap)
              }}
              onDragEnd={() => {
                dragFrom.current = null
                setDropGap(null)
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
