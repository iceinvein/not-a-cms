/**
 * Client-side type re-declarations for the visual page builder.
 * These mirror @not-a-cms/core builder types to avoid importing
 * bun:sqlite into the Vite-bundled admin.
 */

export type GridConfig = {
  columns: number
  rowHeight: number
  gap: number
}

export type GridArea = {
  column: number
  columnSpan: number
  row: number
  rowSpan: number
}

export type StyleOverrides = {
  className?: string
  styles?: Record<string, string>
}

export type ResponsiveOverrides = {
  gridArea?: Partial<GridArea>
  style?: StyleOverrides
  hidden?: boolean
}

export type PageComponent = {
  _type: "component"
  _id: string
  component: string
  props: Record<string, unknown>
  gridArea: GridArea
  style?: StyleOverrides
  responsive?: {
    tablet?: ResponsiveOverrides
    mobile?: ResponsiveOverrides
  }
}

export type PageSection = {
  _type: "section"
  _id: string
  label?: string
  grid: GridConfig
  children: PageComponent[]
  style?: StyleOverrides
}

export type PageLayout = {
  _type: "page"
  sections: PageSection[]
  styles?: Record<string, Record<string, string>>
}

export type ComponentPropDef = {
  type: "text" | "number" | "boolean" | "media" | "select" | "group"
  default?: unknown
  label?: string
  options?: string[]
  fields?: Record<string, ComponentPropDef>
}

export type ComponentDef = {
  name: string
  label: string
  category?: string
  icon?: string
  props: Record<string, ComponentPropDef>
}

export const DEFAULT_GRID: GridConfig = {
  columns: 12,
  rowHeight: 60,
  gap: 16,
}

export function createId(): string {
  return crypto.randomUUID()
}

export function createEmptySection(label?: string): PageSection {
  return {
    _type: "section",
    _id: createId(),
    label,
    grid: { ...DEFAULT_GRID },
    children: [],
  }
}

export function createEmptyLayout(): PageLayout {
  return {
    _type: "page",
    sections: [createEmptySection("Main")],
  }
}

export function createComponentInstance(
  componentName: string,
  props: Record<string, unknown>,
): PageComponent {
  return {
    _type: "component",
    _id: createId(),
    component: componentName,
    props,
    gridArea: { column: 1, columnSpan: 12, row: 1, rowSpan: 1 },
  }
}
