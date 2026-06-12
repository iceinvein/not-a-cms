// packages/admin/src/components/continuum/canvas/presence.ts

import type { CursorState } from "@not-a-cms/editor"
import { safeCssColor } from "@not-a-cms/editor"
import { activeBlockPos, type BlockTreeNode } from "./block-tree"
import type { BlockBox, RectLike } from "./overlay-geometry"

/** A remote collaborator's selection, resolved to the pixel box of its enclosing section. */
export type RemoteSelection = {
  clientId: string
  color: string
  name: string
  box: RectLike
}

/**
 * Map each remote cursor to the box of the top-level block its `head` falls inside. Cursors whose
 * head maps to no current block (e.g. a stale position after a concurrent edit) are skipped. One
 * entry is emitted per cursor, so two collaborators on the same section yield two entries sharing
 * a box (the renderer stacks their name chips). Pure, so it is unit-tested without a DOM.
 */
export function remoteSelectionBoxes(
  cursors: CursorState[],
  blocks: BlockTreeNode[],
  boxes: BlockBox[],
): RemoteSelection[] {
  const boxByPos = new Map(boxes.map((b) => [b.pos, b]))
  const result: RemoteSelection[] = []
  for (const cursor of cursors) {
    const pos = activeBlockPos(blocks, cursor.head)
    if (pos == null) continue
    const box = boxByPos.get(pos)
    if (!box) continue
    result.push({
      clientId: cursor.clientId,
      color: safeCssColor(cursor.user.color),
      name: cursor.user.name,
      box: box.box,
    })
  }
  return result
}
