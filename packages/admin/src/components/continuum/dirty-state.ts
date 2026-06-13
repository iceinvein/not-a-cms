import type { AdminFieldDef } from "../../lib/content-fields"
import { buildPayload } from "../../lib/content-payload"

export type SaveState = "saving" | "unsaved" | "saved" | "error"

/**
 * A stable serialization of a document's editable fields, used to detect unsaved changes.
 * Built from `buildPayload`, which iterates fields in definition order, so the string is
 * independent of the runtime key order of `data` (no false "unsaved" after a no-op render).
 */
export function documentSnapshot(
  data: Record<string, unknown>,
  fields: Record<string, AdminFieldDef>,
): string {
  return JSON.stringify(buildPayload(data, fields))
}

/**
 * Whether the current snapshot differs from the last saved baseline. A null baseline means
 * the document has not loaded/saved yet, so it is never dirty (we don't warn about edits the
 * user hasn't made).
 */
export function isDirty(saved: string | null, current: string): boolean {
  return saved !== null && saved !== current
}

/** The single status the editor surfaces, in precedence order. */
export function saveState(input: {
  saving: boolean
  dirty: boolean
  error: string | null
}): SaveState {
  if (input.saving) return "saving"
  if (input.error) return "error"
  return input.dirty ? "unsaved" : "saved"
}

/** Plain-language label for the editor's save-state indicator. */
export function saveStateLabel(state: SaveState): string {
  switch (state) {
    case "saving":
      return "Saving…"
    case "unsaved":
      return "Unsaved changes"
    case "error":
      return "Save failed"
    default:
      return "All changes saved"
  }
}
