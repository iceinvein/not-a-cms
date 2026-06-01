import { describe, expect, test } from "bun:test"
import { toPortableText } from "../../src/portable-text/to-portable-text"
import { fromPortableText } from "../../src/portable-text/from-portable-text"

describe("custom block round-trip", () => {
  test("callout (inline content) survives to PT and back", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "callout",
          attrs: { variant: "info" },
          content: [{ type: "text", text: "Heads up" }],
        },
      ],
    }
    const pt = toPortableText(doc as any)
    expect(pt).toEqual([
      { type: "callout", variant: "info", children: [{ type: "text", value: "Heads up" }] },
    ])
    const back = fromPortableText(pt)
    expect(back.content[0]).toMatchObject({
      type: "callout",
      attrs: { variant: "info" },
      content: [{ type: "text", text: "Heads up" }],
    })
  })

  test("atom field-block (no content) preserves its attributes", () => {
    const doc = {
      type: "doc",
      content: [{ type: "author", attrs: { authorId: "u_42", role: "Founder" } }],
    }
    const pt = toPortableText(doc as any)
    expect(pt).toEqual([{ type: "author", authorId: "u_42", role: "Founder" }])
    const back = fromPortableText(pt)
    expect(back.content[0]).toEqual({ type: "author", attrs: { authorId: "u_42", role: "Founder" } })
  })

  test("known blocks are unaffected", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
    }
    expect(toPortableText(doc as any)).toEqual([
      { type: "paragraph", children: [{ type: "text", value: "hi" }] },
    ])
  })
})
