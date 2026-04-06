import { useDroppable } from "@dnd-kit/core"
import type { PageSection, PageComponent, ComponentDef, GridArea } from "../../lib/builder-types"
import { GridCanvas } from "./GridCanvas"

type CanvasRendererProps = {
  section: PageSection
  componentDefs: Map<string, ComponentDef>
  selectedComponentId: string | null
  onSelectComponent: (id: string | null) => void
  onUpdateGridArea: (componentId: string, gridArea: GridArea) => void
}

export function CanvasRenderer({
  section,
  componentDefs,
  selectedComponentId,
  onSelectComponent,
  onUpdateGridArea,
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
        isOver ? "border-blue-400 bg-blue-50/30" : "border-gray-200 bg-white"
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
          <div key={i} className="border border-gray-400 rounded-sm" />
        ))}
      </div>

      {/* Component grid */}
      {section.children.length === 0 ? (
        <div
          className="flex items-center justify-center text-sm text-gray-400 py-12"
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
            return (
              <div
                key={component._id}
                style={{
                  gridColumn: `${component.gridArea.column} / span ${component.gridArea.columnSpan}`,
                  gridRow: `${component.gridArea.row} / span ${component.gridArea.rowSpan}`,
                  zIndex: isSelected ? 10 : 1,
                }}
              >
                <GridCanvas
                  grid={grid}
                  gridArea={component.gridArea}
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
          ? "border-blue-500 bg-blue-50/50 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
          {label}
        </span>
      </div>
      {preview && (
        <p className="text-sm text-gray-600 truncate">{preview}</p>
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
