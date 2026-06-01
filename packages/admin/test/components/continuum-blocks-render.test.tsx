import { describe, expect, test } from "bun:test"
import { continuumBlocks, continuumSlashCommands } from "../../src/components/continuum/blocks"

describe("continuum blocks", () => {
  test("defines author, gallery, and seo blocks", () => {
    const names = continuumBlocks.map((b) => b.name)
    expect(names).toContain("author")
    expect(names).toContain("gallery")
    expect(names).toContain("seo")
  })

  test("provides a slash command per block", () => {
    const titles = continuumSlashCommands.map((c) => c.title)
    expect(titles).toContain("Author")
    expect(titles).toContain("Gallery")
    expect(titles).toContain("SEO & meta")
  })
})
