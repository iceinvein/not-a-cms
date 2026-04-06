import { useState, useEffect, useCallback, useMemo } from "react"
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import {
  type PageLayout,
  type PageComponent,
  type ComponentDef,
  type GridArea,
  createEmptyLayout,
  createEmptySection,
  createComponentInstance,
} from "../../lib/builder-types"
import { ComponentPalette } from "./ComponentPalette"
import { ComponentConfigurator } from "./ComponentConfigurator"
import { SectionManager } from "./SectionManager"
import { CanvasRenderer } from "./CanvasRenderer"

type PageBuilderProps = {
  initialLayout: PageLayout | undefined
  onChange: (layout: PageLayout) => void
  apiBase: string
}

export function PageBuilder({ initialLayout, onChange, apiBase }: PageBuilderProps) {
  const [layout, setLayout] = useState<PageLayout>(() => initialLayout ?? createEmptyLayout())
  const [componentDefs, setComponentDefs] = useState<Map<string, ComponentDef>>(new Map())
  const [componentDefsLoading, setComponentDefsLoading] = useState(true)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(
    () => layout.sections[0]?._id ?? null,
  )
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  // Sync layout changes upstream
  const updateLayout = useCallback(
    (updater: (prev: PageLayout) => PageLayout) => {
      setLayout((prev) => {
        const next = updater(prev)
        onChange(next)
        return next
      })
    },
    [onChange],
  )

  // Load component definitions
  useEffect(() => {
    setComponentDefsLoading(true)
    fetch(`${apiBase}/api/_components`)
      .then((res) => res.json())
      .then((list: ComponentDef[]) => {
        const map = new Map<string, ComponentDef>()
        for (const c of list) map.set(c.name, c)
        setComponentDefs(map)
      })
      .catch(() => {})
      .finally(() => setComponentDefsLoading(false))
  }, [apiBase])

  // Group component defs by category for the palette
  const groupedComponents = useMemo(() => {
    const grouped: Record<string, ComponentDef[]> = {}
    for (const def of componentDefs.values()) {
      const category = def.category ?? "general"
      if (!grouped[category]) grouped[category] = []
      grouped[category].push(def)
    }
    return grouped
  }, [componentDefs])

  // --- Section operations ---

  const addSection = () => {
    const section = createEmptySection(`Section ${layout.sections.length + 1}`)
    updateLayout((prev) => ({
      ...prev,
      sections: [...prev.sections, section],
    }))
    setActiveSectionId(section._id)
  }

  const removeSection = (id: string) => {
    let fallbackId: string | null = null
    updateLayout((prev) => {
      const filtered = prev.sections.filter((s) => s._id !== id)
      if (filtered.length === 0) return prev
      fallbackId = filtered[0]._id
      return { ...prev, sections: filtered }
    })
    setActiveSectionId((current) => {
      if (current === id) {
        setSelectedComponentId(null)
        return fallbackId
      }
      return current
    })
  }

  const renameSection = (id: string, label: string) => {
    updateLayout((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s._id === id ? { ...s, label } : s)),
    }))
  }

  // --- Component operations ---

  const addComponentToSection = (componentDef: ComponentDef) => {
    const sectionId = activeSectionId
    if (!sectionId) return

    const defaults: Record<string, unknown> = {}
    for (const [propName, propDef] of Object.entries(componentDef.props)) {
      if (propDef.default !== undefined) defaults[propName] = propDef.default
    }

    const instance = createComponentInstance(componentDef.name, defaults)

    updateLayout((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => {
        if (s._id !== sectionId) return s
        // Place the new component in the next available row
        const maxRow = s.children.reduce(
          (max, c) => Math.max(max, c.gridArea.row + c.gridArea.rowSpan - 1),
          0,
        )
        return {
          ...s,
          children: [
            ...s.children,
            { ...instance, gridArea: { ...instance.gridArea, row: maxRow + 1 } },
          ],
        }
      }),
    }))

    setSelectedComponentId(instance._id)
  }

  const updateComponent = (updated: PageComponent) => {
    updateLayout((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => ({
        ...s,
        children: s.children.map((c) => (c._id === updated._id ? updated : c)),
      })),
    }))
  }

  const deleteComponent = (id: string) => {
    updateLayout((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => ({
        ...s,
        children: s.children.filter((c) => c._id !== id),
      })),
    }))
    if (selectedComponentId === id) setSelectedComponentId(null)
  }

  const updateGridArea = (componentId: string, gridArea: GridArea) => {
    updateLayout((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => ({
        ...s,
        children: s.children.map((c) =>
          c._id === componentId ? { ...c, gridArea } : c,
        ),
      })),
    }))
  }

  // --- DnD handlers ---

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)

    // Drop from palette into a section
    if (activeId.startsWith("palette-")) {
      const componentDef = active.data.current?.component as ComponentDef | undefined
      if (componentDef) {
        addComponentToSection(componentDef)
      }
      return
    }

    // Reorder within the same section
    const overId = String(over.id)
    if (activeId !== overId) {
      updateLayout((prev) => ({
        ...prev,
        sections: prev.sections.map((section) => {
          const oldIndex = section.children.findIndex((c) => c._id === activeId)
          const newIndex = section.children.findIndex((c) => c._id === overId)
          if (oldIndex === -1 || newIndex === -1) return section
          return {
            ...section,
            children: arrayMove(section.children, oldIndex, newIndex),
          }
        }),
      }))
    }
  }

  // Find the selected component and its definition
  const selectedComponent = layout.sections
    .flatMap((s) => s.children)
    .find((c) => c._id === selectedComponentId)
  const selectedDef = selectedComponent ? componentDefs.get(selectedComponent.component) : undefined

  const activeSection = layout.sections.find((s) => s._id === activeSectionId)

  // Drag overlay content
  const dragOverlayContent = (() => {
    if (!activeDragId) return null
    if (activeDragId.startsWith("palette-")) {
      const name = activeDragId.replace("palette-", "")
      const def = componentDefs.get(name)
      return (
        <div className="px-3 py-2 bg-blue-100 border border-blue-300 rounded-lg text-sm shadow-lg">
          {def?.label ?? name}
        </div>
      )
    }
    const comp = layout.sections.flatMap((s) => s.children).find((c) => c._id === activeDragId)
    if (comp) {
      const def = componentDefs.get(comp.component)
      return (
        <div className="px-3 py-2 bg-white border-2 border-blue-400 rounded-lg text-sm shadow-lg">
          {def?.label ?? comp.component}
        </div>
      )
    }
    return null
  })()

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 h-full" style={{ minHeight: "500px" }}>
        {/* Left sidebar: Sections + Palette */}
        <div className="w-56 shrink-0 space-y-6 overflow-y-auto">
          <SectionManager
            sections={layout.sections}
            activeSectionId={activeSectionId}
            onSelectSection={setActiveSectionId}
            onAddSection={addSection}
            onRemoveSection={removeSection}
            onRenameSection={renameSection}
          />
          <ComponentPalette
            components={groupedComponents}
            loading={componentDefsLoading}
            onAddComponent={addComponentToSection}
          />
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 overflow-y-auto">
          {activeSection ? (
            <div>
              <div className="text-xs text-gray-400 mb-2 px-1">
                {activeSection.label || "Untitled section"} — {activeSection.children.length} component{activeSection.children.length !== 1 ? "s" : ""}
              </div>
              <CanvasRenderer
                section={activeSection}
                componentDefs={componentDefs}
                selectedComponentId={selectedComponentId}
                onSelectComponent={setSelectedComponentId}
                onUpdateGridArea={updateGridArea}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              Select or create a section to start building
            </div>
          )}
        </div>

        {/* Right sidebar: Configurator */}
        <div className="w-64 shrink-0 overflow-y-auto">
          {selectedComponent && selectedDef ? (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <ComponentConfigurator
                component={selectedComponent}
                definition={selectedDef}
                onChange={updateComponent}
                onDelete={() => deleteComponent(selectedComponent._id)}
              />
            </div>
          ) : (
            <div className="text-sm text-gray-400 p-4">
              Select a component to edit its properties
            </div>
          )}
        </div>
      </div>

      <DragOverlay>{dragOverlayContent}</DragOverlay>
    </DndContext>
  )
}
