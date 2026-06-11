// packages/admin/src/components/continuum/canvas/CanvasOverlay.tsx
import type { Editor as TiptapEditor } from "@tiptap/react"
import { type RefObject, useEffect, useRef, useState } from "react"
import { type BlockTreeNode, gapPosition, topLevelBlocks } from "./block-tree"
import { insertBlockAt } from "./canvas-ops"
import { InsertMenu } from "./InsertMenu"
import {
  type BlockBox,
  boxAtPoint,
  computeBlockBoxes,
  computeGapZones,
  type GapZone,
  nearestGap,
} from "./overlay-geometry"
import { useCanvasSelection } from "./selection"

type Props = {
  editor: TiptapEditor | null
  /** The positioned stage the boxes are measured against (wraps the editor + this overlay). */
  containerRef: RefObject<HTMLDivElement | null>
}

/** How close (px) the pointer must be to a gap center for the `+` inserter to appear. */
const GAP_HOVER_THRESHOLD = 22

/**
 * Absolutely-positioned chrome layer over the canvas stage. The layer itself is
 * pointer-events:none; only the `+` inserter control re-enables pointer events. It tracks each
 * top-level block's box and the gap zones between them (recomputed on every editor transaction
 * and on resize/scroll). It draws the hover/selection outlines and type label (Phase 3A), and
 * a hover `+` between blocks that opens the InsertMenu (Phase 3B insert). Hover and nearest-gap
 * are derived from a stage pointermove listener plus pure hit tests, so typing is never blocked.
 * Positioning is verified with agent-browser; the geometry is unit-tested in overlay-geometry.
 */
export function CanvasOverlay({ editor, containerRef }: Props) {
  const [boxes, setBoxes] = useState<BlockBox[]>([])
  const [hovered, setHovered] = useState<number | null>(null)
  const [hoveredGap, setHoveredGap] = useState<GapZone | null>(null)
  const [menuGap, setMenuGap] = useState<GapZone | null>(null)
  const boxesRef = useRef<BlockBox[]>([])
  const blocksRef = useRef<BlockTreeNode[]>([])
  const gapsRef = useRef<GapZone[]>([])
  const { selected } = useCanvasSelection()

  useEffect(() => {
    // The stage container is mounted before `editor` becomes non-null (VisualCanvas sets the
    // editor via the Editor's onReady, which fires after the stage div commits), so the editor
    // dep transitioning null -> editor re-runs this effect with the container present.
    const container = containerRef.current
    if (!editor || !container) return

    const recompute = () => {
      const blocks = topLevelBlocks(editor.state.doc)
      const origin = container.getBoundingClientRect()
      const nextBoxes = computeBlockBoxes(
        blocks,
        (pos) => {
          // nodeDOM can return a non-Element (e.g. a text node); narrow before measuring.
          const dom = editor.view.nodeDOM(pos)
          return dom instanceof HTMLElement ? dom.getBoundingClientRect() : null
        },
        { top: origin.top, left: origin.left },
      )
      blocksRef.current = blocks
      boxesRef.current = nextBoxes
      gapsRef.current = computeGapZones(nextBoxes)
      setBoxes(nextBoxes)
    }

    const onMove = (e: PointerEvent) => {
      const origin = container.getBoundingClientRect()
      const x = e.clientX - origin.left
      const y = e.clientY - origin.top
      setHovered(boxAtPoint(boxesRef.current, x, y)?.pos ?? null)
      setHoveredGap(nearestGap(gapsRef.current, y, GAP_HOVER_THRESHOLD))
    }
    const onLeave = () => {
      setHovered(null)
      setHoveredGap(null)
    }

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

  const doInsert = (type: string) => {
    if (!editor || !menuGap) return
    insertBlockAt(editor as never, gapPosition(blocksRef.current, menuGap.index), type)
    setMenuGap(null)
  }

  // The `+` shows at the menu's gap while the menu is open, otherwise at the hovered gap.
  const plusGap = menuGap ?? hoveredGap

  return (
    <div className="cn-overlay" aria-hidden={menuGap ? undefined : "true"}>
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
      {plusGap ? (
        <button
          type="button"
          className="cn-overlay-insert"
          style={{ top: plusGap.y }}
          aria-label="Insert a block"
          onClick={() => setMenuGap(plusGap)}
        >
          +
        </button>
      ) : null}
      {plusGap ? <div className="cn-overlay-line" style={{ top: plusGap.y }} /> : null}
      {menuGap ? (
        <div className="cn-overlay-menu" style={{ top: menuGap.y }}>
          <InsertMenu onPick={doInsert} onClose={() => setMenuGap(null)} />
        </div>
      ) : null}
    </div>
  )
}
