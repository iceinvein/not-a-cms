import { describe, expect, test } from "bun:test"
import { confirmDelete } from "../../src/lib/confirm-copy"

describe("confirmDelete", () => {
  // Destructive confirms must name what is being deleted and state that it can't be undone,
  // so a user never deletes the wrong thing or assumes it's recoverable.
  test("names a specific item and states irreversibility", () => {
    const msg = confirmDelete({ name: "Summer Sale" })
    expect(msg).toContain("Summer Sale")
    expect(msg).toMatch(/can't be undone|cannot be undone/i)
  })

  // When there's no human name, fall back to a noun, never an empty quote.
  test("falls back to a noun when no name is given", () => {
    const msg = confirmDelete({ noun: "webhook" })
    expect(msg).toContain("webhook")
    expect(msg).not.toContain('""')
    expect(msg).toMatch(/can't be undone|cannot be undone/i)
  })

  // Bulk deletes report the count with correct pluralization.
  test("pluralizes a bulk count", () => {
    expect(confirmDelete({ count: 3, noun: "item" })).toContain("3 items")
    expect(confirmDelete({ count: 1, noun: "item" })).toContain("1 item")
    expect(confirmDelete({ count: 1, noun: "item" })).not.toContain("1 items")
  })
})
