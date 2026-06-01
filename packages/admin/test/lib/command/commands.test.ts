import { describe, expect, test } from "bun:test"
import {
  buildDoCommands,
  buildJumpCommands,
  rankCommands,
  type Command,
} from "../../../src/lib/command/commands"

const collections = [
  { name: "blog_post", labels: { singular: "Blog Post", plural: "Blog Posts" }, fields: {} },
  { name: "page", labels: { singular: "Page", plural: "Pages" }, fields: {} },
]

describe("buildJumpCommands", () => {
  test("includes dashboard, media, settings and one entry per collection", () => {
    const cmds = buildJumpCommands(collections)
    const titles = cmds.map((c) => c.title)
    expect(titles).toContain("Dashboard")
    expect(titles).toContain("Media")
    expect(titles).toContain("Blog Posts")
    expect(titles).toContain("Pages")
    expect(cmds.every((c) => c.scope === "jump")).toBe(true)
  })

  test("collection jump points at its list route", () => {
    const cmd = buildJumpCommands(collections).find((c) => c.title === "Blog Posts")!
    expect(cmd.href).toBe("/content/blog_post")
  })
})

describe("buildDoCommands", () => {
  test("inside a document, returns publish/schedule/preview actions", () => {
    const cmds = buildDoCommands({ collection: "blog_post", documentId: "x1" })
    const ids = cmds.map((c) => c.id)
    expect(ids).toContain("publish")
    expect(ids).toContain("schedule")
    expect(ids).toContain("preview")
    expect(cmds.every((c) => c.scope === "do")).toBe(true)
  })

  test("outside a document, returns no document actions", () => {
    expect(buildDoCommands({})).toEqual([])
  })
})

describe("rankCommands", () => {
  const cmds: Command[] = [
    { id: "a", scope: "jump", title: "Blog Posts", icon: "collection", href: "/content/blog_post" },
    { id: "b", scope: "jump", title: "Pages", icon: "collection", href: "/content/page" },
    { id: "c", scope: "jump", title: "Media", icon: "media", href: "/media" },
  ]

  test("empty query returns all in original order", () => {
    expect(rankCommands("", cmds).map((c) => c.id)).toEqual(["a", "b", "c"])
  })

  test("filters and ranks by relevance", () => {
    const out = rankCommands("blog", cmds)
    expect(out[0].id).toBe("a")
    expect(out.find((c) => c.id === "c")).toBeUndefined()
  })

  test("subsequence match works (pgs -> Pages)", () => {
    const out = rankCommands("pgs", cmds)
    expect(out[0].id).toBe("b")
  })
})
