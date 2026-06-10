// packages/admin/src/components/continuum/canvas/selection.tsx
import { createContext, useContext } from "react"

export type CanvasSelection = { pos: number; name: string } | null

export type CanvasSelectionValue = {
  selected: CanvasSelection
  /** Mark a block selected (called by a living node-view on click/focus). */
  select: (selection: { pos: number; name: string }) => void
  clear: () => void
}

const noop = () => {}

export const CanvasSelectionContext = createContext<CanvasSelectionValue>({
  selected: null,
  select: noop,
  clear: noop,
})

export function useCanvasSelection(): CanvasSelectionValue {
  return useContext(CanvasSelectionContext)
}
