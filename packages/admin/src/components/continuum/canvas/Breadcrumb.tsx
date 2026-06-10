// packages/admin/src/components/continuum/canvas/Breadcrumb.tsx
import type { Editor as TiptapEditor } from "@tiptap/react"
import { activeBlockPos, topLevelBlocks } from "./block-tree"

type Props = { editor: TiptapEditor | null }

/**
 * Shallow ancestry strip for the current selection. The content model is a flat list, so the
 * path is "Document > <block label>" (or just "Document" when nothing is selected).
 */
export function Breadcrumb({ editor }: Props) {
  let label: string | null = null
  if (editor) {
    const blocks = topLevelBlocks(editor.state.doc)
    const active = activeBlockPos(blocks, editor.state.selection.from)
    label = blocks.find((b) => b.pos === active)?.label ?? null
  }
  return (
    <nav className="cn-breadcrumb" aria-label="Selection path">
      <span className="cn-breadcrumb-root">Document</span>
      {label ? (
        <>
          <span className="cn-breadcrumb-sep" aria-hidden="true">
            /
          </span>
          <span className="cn-breadcrumb-current">{label}</span>
        </>
      ) : null}
    </nav>
  )
}
