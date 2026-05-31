import { useDraggable } from "@dnd-kit/core"
import { EmptyState, LoadingState } from "../AdminState"
import type { ComponentDef } from "../../lib/builder-types"

type PaletteItemProps = {
  component: ComponentDef
  onAddComponent: (component: ComponentDef) => void
}

function PaletteItem({ component, onAddComponent }: PaletteItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${component.name}`,
    data: { type: "palette-item", component },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onAddComponent(component)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#18181b] cursor-grab hover:border-[rgba(255,255,255,0.1)] hover:bg-[#27272a] transition-colors text-sm ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <span className="text-[#52525b] text-xs w-5 text-center">
        {iconForComponent(component.icon)}
      </span>
      <span className="text-[#a1a1aa]">{component.label}</span>
    </div>
  )
}

function iconForComponent(icon?: string): string {
  switch (icon) {
    case "layout": return "\u25A1"
    case "type": return "T"
    case "image": return "\u25A3"
    case "mouse-pointer": return "\u2197"
    default: return "\u25CB"
  }
}

type ComponentPaletteProps = {
  components: Record<string, ComponentDef[]>
  loading?: boolean
  onAddComponent: (component: ComponentDef) => void
}

export function ComponentPalette({ components, loading, onAddComponent }: ComponentPaletteProps) {
  if (loading) {
    return <LoadingState compact title="Loading components" description="Fetching registered blocks." />
  }

  const categories = Object.keys(components)
  if (categories.length === 0) {
    return <EmptyState compact title="No components registered" description="Register components on the server to use the page builder." />
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-[#71717a] uppercase tracking-wider px-1">
        Components
      </h3>
      {categories.map((category) => (
        <div key={category}>
          <h4 className="text-xs font-medium text-[#52525b] mb-1.5 px-1 capitalize">
            {category}
          </h4>
          <div className="space-y-1">
            {components[category].map((component) => (
              <PaletteItem
                key={component.name}
                component={component}
                onAddComponent={onAddComponent}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
