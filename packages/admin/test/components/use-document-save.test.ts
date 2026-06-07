import { describe, expect, test } from "bun:test"
import { shouldRunWorkflowTransition } from "../../src/components/continuum/use-document"

describe("shouldRunWorkflowTransition", () => {
  // F-016: clicking "Save" (save_draft) on a published document must NOT fire a
  // workflow transition, because that would pull the live document back to draft and
  // unpublish it. "Save" persists field edits via PATCH and leaves status untouched.
  test("save_draft never runs a workflow transition", () => {
    expect(shouldRunWorkflowTransition("save_draft")).toBe(false)
  })

  test("explicit publication actions do run a workflow transition", () => {
    expect(shouldRunWorkflowTransition("submit_review")).toBe(true)
    expect(shouldRunWorkflowTransition("publish")).toBe(true)
    expect(shouldRunWorkflowTransition("archive")).toBe(true)
  })
})
