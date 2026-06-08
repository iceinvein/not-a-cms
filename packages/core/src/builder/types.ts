export type GridConfig = {
  columns: number // default 12
  rowHeight: number // px, default 60
  gap: number // px, default 16
}

export type GridArea = {
  column: number // 1-based
  columnSpan: number // default 1
  row: number // 1-based
  rowSpan: number // default 1
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
  component: string // registry name
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
  styles?: Record<string, Record<string, string>> // className -> CSS properties
}

export const DEFAULT_GRID: GridConfig = {
  columns: 12,
  rowHeight: 60,
  gap: 16,
}

export function createEmptySection(label?: string): PageSection {
  return {
    _type: "section",
    _id: crypto.randomUUID(),
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
