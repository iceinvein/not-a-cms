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

type ResponsiveOverrides = {
  gridArea?: Partial<GridArea>
  style?: { className?: string; styles?: Record<string, string> }
  hidden?: boolean
}

type PageComponent = {
  _type: "component"
  _id: string
  component: string
  props: Record<string, unknown>
  gridArea: GridArea
  style?: { className?: string; styles?: Record<string, string> }
  responsive?: {
    tablet?: ResponsiveOverrides
    mobile?: ResponsiveOverrides
  }
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

export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
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

  return `<div data-component="${escapeAttr(component.component)}" data-id="${escapeAttr(component._id)}" style="${inlineStyles.join(";")}"${classAttr}>${content}</div>`
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

const BREAKPOINT_MAX_WIDTHS: Record<string, number> = {
  tablet: 768,
  mobile: 375,
}

function renderResponsiveStyles(layout: PageLayout): string {
  const breakpointRules: Record<string, string[]> = {
    tablet: [],
    mobile: [],
  }

  for (const section of layout.sections) {
    for (const component of section.children) {
      if (!component.responsive) continue

      for (const bp of ["tablet", "mobile"] as const) {
        const overrides = component.responsive[bp]
        if (!overrides) continue

        const rules: string[] = []

        if (overrides.hidden) {
          rules.push("display:none")
        }

        if (overrides.gridArea) {
          const merged = { ...component.gridArea, ...overrides.gridArea }
          rules.push(`grid-column:${merged.column} / span ${merged.columnSpan}`)
          rules.push(`grid-row:${merged.row} / span ${merged.rowSpan}`)
        }

        if (overrides.style?.styles) {
          for (const [prop, val] of Object.entries(overrides.style.styles)) {
            rules.push(`${prop}:${val}`)
          }
        }

        if (rules.length > 0) {
          breakpointRules[bp].push(
            `[data-id="${escapeAttr(component._id)}"]{${rules.join(";")}}`
          )
        }
      }
    }
  }

  const parts: string[] = []
  for (const bp of ["tablet", "mobile"]) {
    if (breakpointRules[bp].length > 0) {
      parts.push(
        `@media(max-width:${BREAKPOINT_MAX_WIDTHS[bp]}px){${breakpointRules[bp].join("")}}`
      )
    }
  }

  return parts.length > 0 ? `<style>${parts.join("")}</style>` : ""
}

export function renderPageLayout(layout: PageLayout, renderers: ComponentRendererMap): string {
  if (!layout.sections || layout.sections.length === 0) {
    return ""
  }

  const responsiveStyles = renderResponsiveStyles(layout)
  const sectionsHtml = layout.sections
    .map((section) => renderSection(section, renderers))
    .join("")

  return responsiveStyles + sectionsHtml
}
