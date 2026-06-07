import { test, expect, describe } from "bun:test"
import { filterCommands, DEFAULT_COMMANDS, SlashExtension } from "../../src/extensions/slash-command"

describe("filterCommands", () => {
  test("returns all commands for empty query", () => {
    const result = filterCommands("")
    expect(result.length).toBe(DEFAULT_COMMANDS.length)
  })

  test("filters by title match", () => {
    const result = filterCommands("head")
    expect(result.length).toBe(3) // Heading 1, 2, 3
    expect(result.every((c) => c.title.toLowerCase().includes("head"))).toBe(true)
  })

  test("filters by description match", () => {
    const result = filterCommands("numbered")
    expect(result.length).toBe(1)
    expect(result[0].title).toBe("Ordered List")
  })

  test("returns empty for no match", () => {
    const result = filterCommands("xyznonexistent")
    expect(result).toEqual([])
  })

  test("case insensitive", () => {
    const result = filterCommands("HEADING")
    expect(result.length).toBe(3)
  })

  test("DEFAULT_COMMANDS includes expected items", () => {
    const titles = DEFAULT_COMMANDS.map((c) => c.title)
    expect(titles).toContain("Heading 1")
    expect(titles).toContain("Bullet List")
    expect(titles).toContain("Code Block")
    expect(titles).toContain("Divider")
    expect(titles).toContain("Blockquote")
    // F-013: the callout node is registered in the editor; it must be insertable.
    expect(titles).toContain("Callout")
  })
})

describe("SlashExtension options", () => {
  test("exposes a default commands option equal to DEFAULT_COMMANDS", () => {
    const ext = SlashExtension
    const options = (ext as any).options ?? (ext as any).config?.addOptions?.()
    expect(options?.commands?.length).toBe(DEFAULT_COMMANDS.length)
  })
})
