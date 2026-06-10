// packages/admin/src/components/continuum/canvas/CanvasOverlay.tsx
import type { Editor as TiptapEditor } from "@tiptap/react"
import { type RefObject, useEffect, useRef, useState } from "react"
import { topLevelBlocks } from "./block-tree"
import { type BlockBox, boxAtPoint, computeBlockBoxes } from "./overlay-geometry"
import { useCanvasSelection } from "./selection"

type Props = {
  editor: TiptapEditor | null
  /** The positioned stage the boxes are measured against (wraps the editor + this overlay). */
  containerRef: RefObject<HTMLDivElement | null>
}

/**
 * Absolutely-positioned, pointer-events:none chrome layer over the canvas stage. It tracks
 * each top-level block's box (recomputed on every editor transaction and on resize/scroll)
 * and draws a hover outline + type label and the selection outline. Hover is derived from a
 * pointermove listener on the (interactive) stage plus a pure hit test, so the overlay never
 * blocks typing. Positioning is verified with agent-browser; the box math is unit-tested in
 * overlay-geometry.test.ts.
 */
export function CanvasOverlay({ editor, containerRef }: Props) {
  const [boxes, setBoxes] = useState<BlockBox[]>([])
  const [hovered, setHovered] = useState<number | null>(null)
  const boxesRef = useRef<BlockBox[]>([])
  const { selected } = useCanvasSelection()

  useEffect(() => {
    // The stage container is always mounted before `editor` becomes non-null (VisualCanvas sets
    // the editor via the Editor's onReady, which fires after the stage div commits), so the
    // editor dep transitioning null -> editor re-runs this effect with the container present.
    const container = containerRef.current
    if (!editor || !container) return

    const recompute = () => {
      const blocks = topLevelBlocks(editor.state.doc)
      const origin = container.getBoundingClientRect()
      const next = computeBlockBoxes(
        blocks,
        (pos) => {
          // nodeDOM can return a non-Element (e.g. a text node); narrow before measuring.
          const dom = editor.view.nodeDOM(pos)
          return dom instanceof HTMLElement ? dom.getBoundingClientRect() : null
        },
        { top: origin.top, left: origin.left },
      )
      boxesRef.current = next
      setBoxes(next)
    }

    const onMove = (e: PointerEvent) => {
      const origin = container.getBoundingClientRect()
      const hit = boxAtPoint(boxesRef.current, e.clientX - origin.left, e.clientY - origin.top)
      setHovered(hit ? hit.pos : null)
    }
    const onLeave = () => setHovered(null)

    // Recompute on every transaction (including keystrokes). For the small number of top-level
    // blocks a document holds, the per-block getBoundingClientRect reads are cheap.
    recompute()
    editor.on("transaction", recompute)
    const ro = new ResizeObserver(recompute)
    ro.observe(container)
    window.addEventListener("scroll", recompute, true)
    container.addEventListener("pointermove", onMove)
    container.addEventListener("pointerleave", onLeave)
    return () => {
      editor.off("transaction", recompute)
      ro.disconnect()
      window.removeEventListener("scroll", recompute, true)
      container.removeEventListener("pointermove", onMove)
      container.removeEventListener("pointerleave", onLeave)
    }
  }, [editor, containerRef])

  return (
    <div className="cn-overlay" aria-hidden="true">
      {boxes.map((b) => {
        const isSelected = selected?.pos === b.pos
        const isHovered = hovered === b.pos
        const cls = `cn-overlay-box${isSelected ? " cn-overlay-selected" : ""}${isHovered ? " cn-overlay-hovered" : ""}`
        return (
          <div
            key={b.pos}
            className={cls}
            style={{ top: b.box.top, left: b.box.left, width: b.box.width, height: b.box.height }}
          >
            {(isSelected || isHovered) && <span className="cn-overlay-label">{b.label}</span>}
          </div>
        )
      })}
    </div>
  )
}
