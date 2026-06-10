import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { EditableText } from "../../src/components/continuum/canvas/EditableText"

describe("EditableText", () => {
  test("editable mode renders the tag, class, value, and contenteditable", () => {
    const html = renderToString(
      <EditableText as="h1" className="nac-hero-headline" value="Ship pages" onChange={() => {}} />,
    )
    expect(html).toContain("<h1")
    expect(html).toContain('class="nac-hero-headline"')
    expect(html).toContain("Ship pages")
    expect(html.toLowerCase()).toContain("contenteditable")
  })

  test("editable mode shows the placeholder via data-placeholder when empty", () => {
    const html = renderToString(
      <EditableText as="p" className="nac-hero-sub" value="" placeholder="Subheadline" onChange={() => {}} />,
    )
    expect(html).toContain('data-placeholder="Subheadline"')
  })

  test("static mode renders a plain element with no editing attributes", () => {
    const html = renderToString(
      <EditableText as="h1" className="nac-hero-headline" value="Ship pages" editable={false} onChange={() => {}} />,
    )
    expect(html).toBe('<h1 class="nac-hero-headline">Ship pages</h1>')
  })

  test("static mode renders nothing when empty (matches renderer omission)", () => {
    const html = renderToString(
      <EditableText as="p" className="nac-hero-sub" value="" editable={false} onChange={() => {}} />,
    )
    expect(html).toBe("")
  })
})

describe("EditableText omitWhenEmpty", () => {
  test("static + omitWhenEmpty=false renders the empty element", () => {
    const html = renderToString(
      <EditableText as="span" className="nac-quote-name" value="" editable={false} omitWhenEmpty={false} onChange={() => {}} />,
    )
    expect(html).toBe('<span class="nac-quote-name"></span>')
  })

  test("static + omitWhenEmpty=false with no class renders a bare empty tag", () => {
    const html = renderToString(
      <EditableText as="p" value="" editable={false} omitWhenEmpty={false} onChange={() => {}} />,
    )
    expect(html).toBe("<p></p>")
  })

  test("static default still omits empty (omitWhenEmpty defaults true)", () => {
    const html = renderToString(
      <EditableText as="p" className="nac-hero-sub" value="" editable={false} onChange={() => {}} />,
    )
    expect(html).toBe("")
  })
})

describe("EditableText domAttributes", () => {
  test("static mode spreads extra DOM attributes (no class)", () => {
    const html = renderToString(
      <EditableText
        as="span"
        value="Dana"
        editable={false}
        omitWhenEmpty={false}
        domAttributes={{ "data-author-name": "" }}
        onChange={() => {}}
      />,
    )
    expect(html).toBe('<span data-author-name="">Dana</span>')
  })

  test("editable mode keeps the extra attribute alongside contenteditable", () => {
    const html = renderToString(
      <EditableText
        as="span"
        value="Dana"
        domAttributes={{ "data-author-name": "" }}
        onChange={() => {}}
      />,
    )
    expect(html).toContain("data-author-name")
    expect(html.toLowerCase()).toContain("contenteditable")
  })
})
