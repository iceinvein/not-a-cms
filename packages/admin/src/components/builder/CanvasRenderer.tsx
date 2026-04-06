import { useDroppable } from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { PageSection, PageComponent, ComponentDef } from "../../lib/builder-types"

type CanvasRendererProps = {
  section: PageSection
  componentDefs: Map<string, ComponentDef>
  selectedComponentId: string | null
  onSelectComponent: (id: string | null) => void
}

export function CanvasRenderer({
  section,
  componentDefs,
  selectedComponentId,
  onSelectComponent,
}: CanvasRendererProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `section-${section._id}`,
    data: { type: "section", sectionId: section._id },
  })

  const componentIds = section.children.map((c) => c._id)

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[200px] rounded-lg border-2 border-dashed transition-colors ${
        isOver ? "border-blue-400 bg-blue-50/30" : "border-gray-200 bg-white"
      }`}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${section.grid.columns}, 1fr)`,
        gap: `${section.grid.gap}px`,
        padding: `${section.grid.gap}px`,
        minHeight: section.children.length === 0 ? "200px" : undefined,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelectComponent(null)
      }}
    >
      {section.children.length === 0 ? (
        <div
          className="col-span-full flex items-center justify-center text-sm text-gray-400 py-12"
          style={{ gridColumn: `1 / -1` }}
        >
          Drag components here or click one from the palette
        </div>
      ) : (
        <SortableContext items={componentIds} strategy={verticalListSortingStrategy}>
          {section.children.map((component) => (
            <SortableComponent
              key={component._id}
              component={component}
              definition={componentDefs.get(component.component)}
              isSelected={component._id === selectedComponentId}
              onSelect={() => onSelectComponent(component._id)}
            />
          ))}
        </SortableContext>
      )}
    </div>
  )
}

type SortableComponentProps = {
  component: PageComponent
  definition: ComponentDef | undefined
  isSelected: boolean
  onSelect: () => void
}

function SortableComponent({ component, definition, isSelected, onSelect }: SortableComponentProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: component._id,
    data: { type: "canvas-item", component },
  })

  const style = {
    gridColumn: `${component.gridArea.column} / span ${component.gridArea.columnSpan}`,
    gridRow: `${component.gridArea.row} / span ${component.gridArea.rowSpan}`,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const label = definition?.label ?? component.component
  const preview = getPreviewText(component, definition)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      className={`rounded-lg border-2 p-3 cursor-grab transition-colors ${
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

  // Find the first text-type prop with a value
  for (const [propName, propDef] of Object.entries(definition.props)) {
    if (propDef.type === "text" && component.props[propName]) {
      const val = String(component.props[propName])
      return val.length > 80 ? val.slice(0, 80) + "..." : val
    }
  }
  return ""
}
