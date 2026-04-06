import { test, expect, describe } from "bun:test"
import { renderPageLayout } from "../../src/runtime/page-renderer"

const sampleLayout = {
  _type: "page" as const,
  sections: [
    {
      _type: "section" as const,
      _id: "s1",
      label: "Hero",
      grid: { columns: 12, rowHeight: 60, gap: 16 },
      children: [
        {
          _type: "component" as const,
          _id: "c1",
          component: "hero",
          props: { headline: "Hello World", subheadline: "Welcome to my site" },
          gridArea: { column: 1, columnSpan: 12, row: 1, rowSpan: 1 },
        },
        {
          _type: "component" as const,
          _id: "c2",
          component: "text_block",
          props: { content: "Some text here", alignment: "center" },
          gridArea: { column: 1, columnSpan: 6, row: 2, rowSpan: 1 },
        },
      ],
    },
  ],
}

const componentRenderers = {
  hero: (props: Record<string, unknown>) =>
    `<div class="hero"><h1>${props.headline}</h1><p>${props.subheadline}</p></div>`,
  text_block: (props: Record<string, unknown>) =>
    `<div class="text-block" style="text-align:${props.alignment}">${props.content}</div>`,
}

describe("renderPageLayout", () => {
  test("renders sections with grid layout", () => {
    const html = renderPageLayout(sampleLayout, componentRenderers)
    expect(html).toContain("display:grid")
    expect(html).toContain("grid-template-columns:repeat(12, 1fr)")
    expect(html).toContain("gap:16px")
  })

  test("renders component content via renderers", () => {
    const html = renderPageLayout(sampleLayout, componentRenderers)
    expect(html).toContain("<h1>Hello World</h1>")
    expect(html).toContain("Some text here")
  })

  test("positions components with gridArea", () => {
    const html = renderPageLayout(sampleLayout, componentRenderers)
    expect(html).toContain("grid-column:1 / span 12")
    expect(html).toContain("grid-column:1 / span 6")
  })

  test("skips unknown components gracefully", () => {
    const layoutWithUnknown = {
      _type: "page" as const,
      sections: [
        {
          _type: "section" as const,
          _id: "s1",
          grid: { columns: 12, rowHeight: 60, gap: 16 },
          children: [
            {
              _type: "component" as const,
              _id: "c1",
              component: "unknown_widget",
              props: {},
              gridArea: { column: 1, columnSpan: 12, row: 1, rowSpan: 1 },
            },
          ],
        },
      ],
    }
    const html = renderPageLayout(layoutWithUnknown, componentRenderers)
    expect(html).not.toContain("undefined")
    expect(html).toContain("section")
  })

  test("empty layout renders empty", () => {
    const empty = { _type: "page" as const, sections: [] }
    const html = renderPageLayout(empty, componentRenderers)
    expect(html).toBe("")
  })

  test("applies component inline styles", () => {
    const layoutWithStyles = {
      _type: "page" as const,
      sections: [{
        _type: "section" as const,
        _id: "s1",
        grid: { columns: 12, rowHeight: 60, gap: 16 },
        children: [{
          _type: "component" as const,
          _id: "c1",
          component: "hero",
          props: { headline: "Styled", subheadline: "Sub" },
          gridArea: { column: 1, columnSpan: 12, row: 1, rowSpan: 1 },
          style: { styles: { "background-color": "#1a1a2e", "color": "#fff" } },
        }],
      }],
    }
    const html = renderPageLayout(layoutWithStyles, componentRenderers)
    expect(html).toContain("background-color:#1a1a2e")
    expect(html).toContain("color:#fff")
  })
})
