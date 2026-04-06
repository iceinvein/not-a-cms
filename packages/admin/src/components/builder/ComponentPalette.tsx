import { useState, useEffect } from "react"
import { useDraggable } from "@dnd-kit/core"
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
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white cursor-grab hover:border-blue-300 hover:bg-blue-50 transition-colors text-sm ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <span className="text-gray-400 text-xs w-5 text-center">
        {iconForComponent(component.icon)}
      </span>
      <span className="text-gray-700">{component.label}</span>
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
  apiBase: string
  onAddComponent: (component: ComponentDef) => void
  onComponentsLoaded?: (components: ComponentDef[]) => void
}

export function ComponentPalette({ apiBase, onAddComponent, onComponentsLoaded }: ComponentPaletteProps) {
  const [grouped, setGrouped] = useState<Record<string, ComponentDef[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${apiBase}/api/_components?grouped=true`)
      .then((res) => res.json())
      .then((data: Record<string, ComponentDef[]>) => {
        setGrouped(data)
        if (onComponentsLoaded) {
          const all = Object.values(data).flat()
          onComponentsLoaded(all)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [apiBase])

  if (loading) {
    return <div className="text-sm text-gray-400 p-3">Loading components...</div>
  }

  const categories = Object.keys(grouped)
  if (categories.length === 0) {
    return <div className="text-sm text-gray-400 p-3">No components registered.</div>
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
        Components
      </h3>
      {categories.map((category) => (
        <div key={category}>
          <h4 className="text-xs font-medium text-gray-400 mb-1.5 px-1 capitalize">
            {category}
          </h4>
          <div className="space-y-1">
            {grouped[category].map((component) => (
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
