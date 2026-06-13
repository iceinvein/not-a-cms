import { describe, expect, test } from "bun:test"
import { publishActionConfirm } from "../../src/components/continuum/publish-confirm"

describe("publishActionConfirm", () => {
  // Publish is the highest-stakes action in the product: it must name the consequence
  // (going live on the public site) before it fires. Save/Review stay frictionless.
  test("publish names the going-live consequence and the document", () => {
    const c = publishActionConfirm("publish", "Summer Sale")
    expect(c).not.toBeNull()
    expect(c?.heading).toMatch(/publish/i)
    expect(c?.body).toContain("Summer Sale")
    expect(c?.body).toMatch(/public site/i)
    expect(c?.confirmLabel).toMatch(/publish/i)
  })

  // Archive takes a live document off the public site: it is reversible but consequential,
  // so it confirms and reads as a danger action.
  test("archive names the removal consequence and is danger-toned", () => {
    const c = publishActionConfirm("archive", "Summer Sale")
    expect(c).not.toBeNull()
    expect(c?.body).toContain("Summer Sale")
    expect(c?.body).toMatch(/public site|republish/i)
    expect(c?.tone).toBe("danger")
  })

  // Low-stakes actions never gate behind a confirm.
  test("save_draft and submit_review need no confirmation", () => {
    expect(publishActionConfirm("save_draft", "x")).toBeNull()
    expect(publishActionConfirm("submit_review", "x")).toBeNull()
  })

  // Edge case: an untitled document must still read naturally, never `""` or `"undefined"`.
  test("falls back to a generic name when the title is empty or whitespace", () => {
    const c = publishActionConfirm("publish", "   ")
    expect(c?.body).not.toContain('""')
    expect(c?.body).toMatch(/this document/i)
  })
})
