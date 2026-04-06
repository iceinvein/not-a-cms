import { useRef, useCallback, type ReactNode } from "react"
import type { GridConfig, GridArea } from "../../lib/builder-types"

type GridCanvasProps = {
  grid: GridConfig
  gridArea: GridArea
  onGridAreaChange: (gridArea: GridArea) => void
  children: ReactNode
  isSelected: boolean
}

type HandleType = "right" | "bottom" | "corner"

export function GridCanvas({
  grid,
  gridArea,
  onGridAreaChange,
  children,
  isSelected,
}: GridCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{
    type: "resize" | "move"
    handle?: HandleType
    startX: number
    startY: number
    startArea: GridArea
  } | null>(null)

  const getCellDimensions = useCallback(() => {
    const parent = containerRef.current?.parentElement
    if (!parent) return { cellWidth: 0, cellHeight: grid.rowHeight }
    const parentWidth = parent.clientWidth
    const cellWidth = (parentWidth - (grid.columns - 1) * grid.gap) / grid.columns
    return { cellWidth, cellHeight: grid.rowHeight }
  }, [grid])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const state = dragState.current
      if (!state) return

      const { cellWidth, cellHeight } = getCellDimensions()
      if (cellWidth === 0) return

      const dx = e.clientX - state.startX
      const dy = e.clientY - state.startY

      const deltaCols = Math.round(dx / (cellWidth + grid.gap))
      const deltaRows = Math.round(dy / (cellHeight + grid.gap))

      if (state.type === "resize") {
        let newArea = { ...state.startArea }

        if (state.handle === "right" || state.handle === "corner") {
          const newSpan = Math.max(1, state.startArea.columnSpan + deltaCols)
          newArea.columnSpan = Math.min(
            newSpan,
            grid.columns - state.startArea.column + 1,
          )
        }

        if (state.handle === "bottom" || state.handle === "corner") {
          newArea.rowSpan = Math.max(1, state.startArea.rowSpan + deltaRows)
        }

        onGridAreaChange(newArea)
      } else {
        // Move
        const newCol = state.startArea.column + deltaCols
        const newRow = state.startArea.row + deltaRows

        onGridAreaChange({
          ...state.startArea,
          column: Math.max(
            1,
            Math.min(newCol, grid.columns - state.startArea.columnSpan + 1),
          ),
          row: Math.max(1, newRow),
        })
      }
    },
    [getCellDimensions, grid, onGridAreaChange],
  )

  const handleMouseUp = useCallback(() => {
    dragState.current = null
    document.removeEventListener("mousemove", handleMouseMove)
    document.removeEventListener("mouseup", handleMouseUp)
    document.body.style.userSelect = ""
    document.body.style.cursor = ""
  }, [handleMouseMove])

  const startResize = useCallback(
    (e: React.MouseEvent, handle: HandleType) => {
      e.stopPropagation()
      e.preventDefault()
      dragState.current = {
        type: "resize",
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startArea: { ...gridArea },
      }
      document.body.style.userSelect = "none"
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    },
    [gridArea, handleMouseMove, handleMouseUp],
  )

  const startMove = useCallback(
    (e: React.MouseEvent) => {
      // Only start move from the component itself, not from handles
      if ((e.target as HTMLElement).dataset.handle) return
      dragState.current = {
        type: "move",
        startX: e.clientX,
        startY: e.clientY,
        startArea: { ...gridArea },
      }
      document.body.style.userSelect = "none"
      document.body.style.cursor = "grabbing"
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    },
    [gridArea, handleMouseMove, handleMouseUp],
  )

  return (
    <div ref={containerRef} className="relative" onMouseDown={startMove}>
      {children}

      {isSelected && (
        <>
          {/* Right edge handle */}
          <div
            data-handle="right"
            onMouseDown={(e) => startResize(e, "right")}
            className="absolute top-1/2 -translate-y-1/2 -right-1 w-2 h-8 bg-blue-500 rounded-full cursor-col-resize hover:bg-blue-600 transition-colors"
            style={{ zIndex: 20 }}
          />

          {/* Bottom edge handle */}
          <div
            data-handle="bottom"
            onMouseDown={(e) => startResize(e, "bottom")}
            className="absolute left-1/2 -translate-x-1/2 -bottom-1 h-2 w-8 bg-blue-500 rounded-full cursor-row-resize hover:bg-blue-600 transition-colors"
            style={{ zIndex: 20 }}
          />

          {/* Bottom-right corner handle */}
          <div
            data-handle="corner"
            onMouseDown={(e) => startResize(e, "corner")}
            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-blue-500 rounded-sm cursor-nwse-resize hover:bg-blue-600 transition-colors"
            style={{ zIndex: 20 }}
          />
        </>
      )}
    </div>
  )
}
