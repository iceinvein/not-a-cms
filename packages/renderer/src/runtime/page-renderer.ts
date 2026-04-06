/**
 * Server-side page renderer.
 * Converts a PageLayout JSON structure into an HTML string
 * using registered component renderers.
 */

type GridConfig = {
  columns: number
  rowHeight: number
  gap: number
}

type GridArea = {
  column: number
  columnSpan: number
  row: number
  rowSpan: number
}

type PageComponent = {
  _type: "component"
  _id: string
  component: string
  props: Record<string, unknown>
  gridArea: GridArea
  style?: { className?: string; styles?: Record<string, string> }
}

type PageSection = {
  _type: "section"
  _id: string
  label?: string
  grid: GridConfig
  children: PageComponent[]
  style?: { className?: string; styles?: Record<string, string> }
}

type PageLayout = {
  _type: "page"
  sections: PageSection[]
}

export type ComponentRenderer = (props: Record<string, unknown>) => string
export type ComponentRendererMap = Record<string, ComponentRenderer>

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function renderComponent(component: PageComponent, renderers: ComponentRendererMap): string {
  const renderer = renderers[component.component]
  if (!renderer) {
    // Skip unknown components gracefully
    return ""
  }

  const content = renderer(component.props)
  const { column, columnSpan, row, rowSpan } = component.gridArea

  const inlineStyles = [
    `grid-column:${column} / span ${columnSpan}`,
    `grid-row:${row} / span ${rowSpan}`,
  ]

  if (component.style?.styles) {
    for (const [prop, val] of Object.entries(component.style.styles)) {
      inlineStyles.push(`${prop}:${val}`)
    }
  }

  const classAttr = component.style?.className
    ? ` class="${escapeAttr(component.style.className)}"`
    : ""

  return `<div data-component="${escapeAttr(component.component)}" style="${inlineStyles.join(";")}"${classAttr}>${content}</div>`
}

function renderSection(section: PageSection, renderers: ComponentRendererMap): string {
  const { columns, gap } = section.grid

  const gridStyle = [
    `display:grid`,
    `grid-template-columns:repeat(${columns}, 1fr)`,
    `gap:${gap}px`,
  ]

  if (section.style?.styles) {
    for (const [prop, val] of Object.entries(section.style.styles)) {
      gridStyle.push(`${prop}:${val}`)
    }
  }

  const classAttr = section.style?.className
    ? ` class="${escapeAttr(section.style.className)}"`
    : ""

  const labelAttr = section.label
    ? ` aria-label="${escapeAttr(section.label)}"`
    : ""

  const childrenHtml = section.children
    .map((child) => renderComponent(child, renderers))
    .filter(Boolean)
    .join("")

  return `<section style="${gridStyle.join(";")}"${labelAttr}${classAttr}>${childrenHtml}</section>`
}

export function renderPageLayout(layout: PageLayout, renderers: ComponentRendererMap): string {
  if (!layout.sections || layout.sections.length === 0) {
    return ""
  }

  return layout.sections
    .map((section) => renderSection(section, renderers))
    .join("")
}
