import { describe, expect, test } from "bun:test"
import {
  documentSnapshot,
  isDirty,
  saveState,
  saveStateLabel,
} from "../../src/components/continuum/dirty-state"
import type { AdminFieldDef } from "../../src/lib/content-fields"

const fields: Record<string, AdminFieldDef> = {
  title: { type: "text" },
  body: { type: "text" },
}

describe("documentSnapshot", () => {
  // The dirty check compares serialized snapshots, so the snapshot must be stable: the
  // same field values in a different object key order must produce the same string, or
  // the editor would falsely report "unsaved changes" after a no-op re-render.
  test("is stable regardless of data key order", () => {
    expect(documentSnapshot({ title: "a", body: "c" }, fields)).toBe(
      documentSnapshot({ body: "c", title: "a" }, fields),
    )
  })

  test("changes when a field value changes", () => {
    expect(documentSnapshot({ title: "a" }, fields)).not.toBe(
      documentSnapshot({ title: "z" }, fields),
    )
  })
})

describe("isDirty", () => {
  // Before a baseline is established (document still loading) nothing is dirty, so we
  // never warn about losing changes the user has not made.
  test("is false when no baseline exists yet", () => {
    expect(isDirty(null, "anything")).toBe(false)
  })

  test("is false when current matches the saved baseline", () => {
    expect(isDirty("snap", "snap")).toBe(false)
  })

  test("is true when current differs from the saved baseline", () => {
    expect(isDirty("snap", "snap-edited")).toBe(true)
  })
})

describe("saveState", () => {
  test("saving takes precedence over everything", () => {
    expect(saveState({ saving: true, dirty: true, error: "x" })).toBe("saving")
  })

  test("reports an error when one is present and not saving", () => {
    expect(saveState({ saving: false, dirty: true, error: "boom" })).toBe("error")
  })

  test("reports unsaved when dirty, saved otherwise", () => {
    expect(saveState({ saving: false, dirty: true, error: null })).toBe("unsaved")
    expect(saveState({ saving: false, dirty: false, error: null })).toBe("saved")
  })
})

describe("saveStateLabel", () => {
  test("gives each state a plain-language label", () => {
    expect(saveStateLabel("saving")).toMatch(/saving/i)
    expect(saveStateLabel("unsaved")).toMatch(/unsaved/i)
    expect(saveStateLabel("saved")).toMatch(/saved/i)
    expect(saveStateLabel("error")).toMatch(/fail/i)
  })
})
