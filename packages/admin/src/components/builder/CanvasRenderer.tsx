import { useDroppable } from "@dnd-kit/core"
import type { PageSection, PageComponent, ComponentDef, GridArea, Breakpoint } from "../../lib/builder-types"
import { GridCanvas } from "./GridCanvas"

type CanvasRendererProps = {
  section: PageSection
  componentDefs: Map<string, ComponentDef>
  selectedComponentId: string | null
  onSelectComponent: (id: string | null) => void
  onUpdateGridArea: (componentId: string, gridArea: GridArea) => void
  activeBreakpoint: Breakpoint
}

function getEffectiveGridArea(component: PageComponent, breakpoint: Breakpoint): GridArea {
  const base = component.gridArea
  if (breakpoint === "desktop") return base
  const overrides = component.responsive?.[breakpoint]?.gridArea
  if (!overrides) return base
  return { ...base, ...overrides }
}

function isHiddenAtBreakpoint(component: PageComponent, breakpoint: Breakpoint): boolean {
  if (breakpoint === "desktop") return false
  return component.responsive?.[breakpoint]?.hidden ?? false
}

export function CanvasRenderer({
  section,
  componentDefs,
  selectedComponentId,
  onSelectComponent,
  onUpdateGridArea,
  activeBreakpoint,
}: CanvasRendererProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `section-${section._id}`,
    data: { type: "section", sectionId: section._id },
  })

  const { grid } = section

  // Compute the max row extent for visual grid lines
  const maxRow = Math.max(
    2,
    ...section.children.map((c) => c.gridArea.row + c.gridArea.rowSpan),
  )

  return (
    <div
      ref={setNodeRef}
      className={`relative min-h-[200px] rounded-lg border-2 border-dashed transition-colors ${
        isOver ? "border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.03)]" : "border-[rgba(255,255,255,0.08)] bg-[#18181b]"
      }`}
      style={{ padding: `${grid.gap}px` }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelectComponent(null)
      }}
    >
      {/* Visual grid lines overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${grid.columns}, 1fr)`,
          gridAutoRows: `${grid.rowHeight}px`,
          gap: `${grid.gap}px`,
          padding: `${grid.gap}px`,
        }}
      >
        {Array.from({ length: grid.columns * maxRow }, (_, i) => (
          <div key={i} className="border border-[rgba(255,255,255,0.2)] rounded-sm" />
        ))}
      </div>

      {/* Component grid */}
      {section.children.length === 0 ? (
        <div
          className="flex items-center justify-center text-sm text-[#52525b] py-12"
          style={{ minHeight: "200px" }}
        >
          Drag components here or click one from the palette
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${grid.columns}, 1fr)`,
            gridAutoRows: `${grid.rowHeight}px`,
            gap: `${grid.gap}px`,
            position: "relative",
          }}
        >
          {section.children.map((component) => {
            const isSelected = component._id === selectedComponentId
            const effectiveGrid = getEffectiveGridArea(component, activeBreakpoint)
            const hidden = isHiddenAtBreakpoint(component, activeBreakpoint)
            return (
              <div
                key={component._id}
                style={{
                  gridColumn: `${effectiveGrid.column} / span ${effectiveGrid.columnSpan}`,
                  gridRow: `${effectiveGrid.row} / span ${effectiveGrid.rowSpan}`,
                  zIndex: isSelected ? 10 : 1,
                  ...(hidden ? { opacity: 0.3 } : {}),
                }}
              >
                {hidden ? (
                  <div
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectComponent(component._id)
                    }}
                    className={`h-full rounded-lg border-2 border-dashed p-3 cursor-pointer flex items-center justify-center text-xs ${
                      isSelected ? "border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.03)] text-[#a1a1aa]" : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] text-[#52525b]"
                    }`}
                  >
                    Hidden on {activeBreakpoint}
                  </div>
                ) : (
                  <GridCanvas
                    grid={grid}
                    gridArea={effectiveGrid}
                    onGridAreaChange={(area) => onUpdateGridArea(component._id, area)}
                    isSelected={isSelected}
                  >
                    <ComponentCard
                      component={component}
                      definition={componentDefs.get(component.component)}
                      isSelected={isSelected}
                      onSelect={() => onSelectComponent(component._id)}
                    />
                  </GridCanvas>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

type ComponentCardProps = {
  component: PageComponent
  definition: ComponentDef | undefined
  isSelected: boolean
  onSelect: () => void
}

function ComponentCard({ component, definition, isSelected, onSelect }: ComponentCardProps) {
  const label = definition?.label ?? component.component
  const preview = getPreviewText(component, definition)

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      className={`h-full rounded-lg border-2 p-3 cursor-grab transition-colors ${
        isSelected
          ? "border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.05)] shadow-sm"
          : "border-[rgba(255,255,255,0.06)] bg-[#18181b] hover:border-[rgba(255,255,255,0.1)]"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-[#71717a] bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 rounded">
          {label}
        </span>
      </div>
      {preview && (
        <p className="text-sm text-[#a1a1aa] truncate">{preview}</p>
      )}
    </div>
  )
}

function getPreviewText(component: PageComponent, definition: ComponentDef | undefined): string {
  if (!definition) return ""

  for (const [propName, propDef] of Object.entries(definition.props)) {
    if (propDef.type === "text" && component.props[propName]) {
      const val = String(component.props[propName])
      return val.length > 80 ? val.slice(0, 80) + "..." : val
    }
  }
  return ""
}
