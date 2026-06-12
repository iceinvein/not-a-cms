// packages/admin/src/components/continuum/canvas/RemoteSelections.tsx
import type { CSSProperties } from "react"
import type { RemoteSelection } from "./presence"

type Props = {
  /** Remote selections already resolved to pixel boxes by remoteSelectionBoxes(). */
  selections: RemoteSelection[]
}

/**
 * Draws each remote collaborator's selected section as a colored outline plus a corner name chip.
 * Pure presentation: the parent overlay computes the boxes. The collaborator color is passed via a
 * `--cn-remote-color` custom property the stylesheet uses for the outline and chip. The layer is
 * non-interactive (it lives inside the pointer-events:none overlay HUD).
 */
export function RemoteSelections({ selections }: Props) {
  return (
    <>
      {selections.map((selection) => (
        <div
          key={selection.clientId}
          className="cn-overlay-remote"
          style={
            {
              top: selection.box.top,
              left: selection.box.left,
              width: selection.box.width,
              height: selection.box.height,
              "--cn-remote-color": selection.color,
            } as CSSProperties
          }
        >
          <span className="cn-overlay-remote-label">{selection.name}</span>
        </div>
      ))}
    </>
  )
}
