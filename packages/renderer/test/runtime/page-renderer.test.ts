import { test, expect, describe } from "bun:test"
import { renderPageLayout, resolveComponentRenderers } from "../../src/runtime/page-renderer"

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

  test("drops unsafe style properties and values", () => {
    const layoutWithUnsafeStyles = {
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
          style: {
            styles: {
              "background-color": "red;position:fixed",
              "background-image": "url(javascript:alert(1))",
              "color": "#fff",
            },
          },
        }],
      }],
    }
    const html = renderPageLayout(layoutWithUnsafeStyles, componentRenderers)
    expect(html).toContain("color:#fff")
    expect(html).not.toContain("position:fixed")
    expect(html).not.toContain("javascript:")
    expect(html).not.toContain("background-image")
  })

  test("renders responsive media queries for tablet overrides", () => {
    const layoutWithResponsive = {
      _type: "page" as const,
      sections: [{
        _type: "section" as const,
        _id: "s1",
        grid: { columns: 12, rowHeight: 60, gap: 16 },
        children: [{
          _type: "component" as const,
          _id: "c1",
          component: "hero",
          props: { headline: "Hello", subheadline: "World" },
          gridArea: { column: 1, columnSpan: 6, row: 1, rowSpan: 1 },
          responsive: {
            tablet: { gridArea: { columnSpan: 12 } },
            mobile: { hidden: true },
          },
        }],
      }],
    }
    const html = renderPageLayout(layoutWithResponsive, componentRenderers)
    expect(html).toContain("@media(max-width:768px)")
    expect(html).toContain("grid-column:1 / span 12")
    expect(html).toContain("@media(max-width:375px)")
    expect(html).toContain("display:none")
  })

  test("drops unsafe responsive style overrides", () => {
    const layoutWithResponsive = {
      _type: "page" as const,
      sections: [{
        _type: "section" as const,
        _id: "s1",
        grid: { columns: 12, rowHeight: 60, gap: 16 },
        children: [{
          _type: "component" as const,
          _id: "c1",
          component: "hero",
          props: { headline: "Hello", subheadline: "World" },
          gridArea: { column: 1, columnSpan: 6, row: 1, rowSpan: 1 },
          responsive: {
            tablet: { style: { styles: { color: "red;background:url(javascript:alert(1))" } } },
          },
        }],
      }],
    }
    const html = renderPageLayout(layoutWithResponsive, componentRenderers)
    expect(html).not.toContain("javascript:")
    expect(html).not.toContain("background:url")
  })

  test("no style tag when no responsive overrides", () => {
    const html = renderPageLayout(sampleLayout, componentRenderers)
    expect(html).not.toContain("<style>")
  })

  test("renders data-id attribute on components", () => {
    const html = renderPageLayout(sampleLayout, componentRenderers)
    expect(html).toContain('data-id="c1"')
    expect(html).toContain('data-id="c2"')
  })

  test("merges theme component overrides with safe fallback to defaults", () => {
    const renderers = resolveComponentRenderers(componentRenderers, {
      hero: (props) => `<section class="theme-hero">${props.headline}</section>`,
    })
    const html = renderPageLayout(sampleLayout, renderers)

    expect(html).toContain('class="theme-hero"')
    expect(html).toContain('class="text-block"')
  })

  test("ignores invalid theme component overrides", () => {
    const renderers = resolveComponentRenderers(componentRenderers, {
      hero: "not a renderer" as any,
    })
    const html = renderPageLayout(sampleLayout, renderers)

    expect(html).toContain('class="hero"')
    expect(html).toContain('class="text-block"')
  })
})
