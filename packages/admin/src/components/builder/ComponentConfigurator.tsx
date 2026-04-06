import { useState } from "react"
import type { PageComponent, ComponentDef, ComponentPropDef, GridArea, Breakpoint, ResponsiveOverrides } from "../../lib/builder-types"
import { StyleEditor } from "./StyleEditor"

type ComponentConfiguratorProps = {
  component: PageComponent
  definition: ComponentDef
  onChange: (updated: PageComponent) => void
  onDelete: () => void
  activeBreakpoint: Breakpoint
}

export function ComponentConfigurator({
  component,
  definition,
  onChange,
  onDelete,
  activeBreakpoint,
}: ComponentConfiguratorProps) {
  const [activeTab, setActiveTab] = useState<"props" | "style" | "position" | "responsive">("props")

  const updateProp = (propName: string, value: unknown) => {
    onChange({
      ...component,
      props: { ...component.props, [propName]: value },
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{definition.label}</h3>
        <button
          onClick={onDelete}
          className="text-xs text-red-500 hover:text-red-700 transition-colors px-2 py-1 rounded hover:bg-red-50"
        >
          Remove
        </button>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-3">
        <button
          onClick={() => setActiveTab("props")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "props"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Properties
        </button>
        <button
          onClick={() => setActiveTab("style")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "style"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Style
        </button>
        <button
          onClick={() => setActiveTab("position")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "position"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Position
        </button>
        <button
          onClick={() => setActiveTab("responsive")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "responsive"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Responsive
        </button>
      </div>

      {activeTab === "props" ? (
        <div className="space-y-3">
          {Object.entries(definition.props).map(([propName, propDef]) => (
            <PropEditor
              key={propName}
              name={propName}
              def={propDef}
              value={component.props[propName] ?? propDef.default ?? ""}
              onChange={(value) => updateProp(propName, value)}
            />
          ))}
        </div>
      ) : activeTab === "style" ? (
        <StyleEditor
          style={component.style}
          onChange={(style) => onChange({ ...component, style })}
        />
      ) : activeTab === "responsive" ? (
        <ResponsiveEditor
          component={component}
          activeBreakpoint={activeBreakpoint}
          onChange={onChange}
        />
      ) : (
        <PositionEditor
          gridArea={component.gridArea}
          onChange={(gridArea) => onChange({ ...component, gridArea })}
        />
      )}
    </div>
  )
}

type PropEditorProps = {
  name: string
  def: ComponentPropDef
  value: unknown
  onChange: (value: unknown) => void
}

function PropEditor({ name, def, value, onChange }: PropEditorProps) {
  const label = def.label || name.replace(/_/g, " ").replace(/^./, (s) => s.toUpperCase())

  switch (def.type) {
    case "text":
    case "media":
      return (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
          <input
            type="text"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder={def.type === "media" ? "URL or media path" : ""}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )

    case "number":
      return (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
          <input
            type="number"
            value={Number(value) || ""}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )

    case "boolean":
      return (
        <label className="flex items-center gap-2 py-1">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">{label}</span>
        </label>
      )

    case "select":
      return (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
          <select
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select...</option>
            {(def.options || []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )

    case "group":
      return (
        <div className="border border-gray-200 rounded p-2.5 space-y-2">
          <label className="block text-xs font-semibold text-gray-600">{label}</label>
          {def.fields &&
            Object.entries(def.fields).map(([fieldName, fieldDef]) => (
              <PropEditor
                key={fieldName}
                name={fieldName}
                def={fieldDef}
                value={(value as Record<string, unknown>)?.[fieldName] ?? fieldDef.default ?? ""}
                onChange={(fieldValue) => {
                  const group = (value as Record<string, unknown>) ?? {}
                  onChange({ ...group, [fieldName]: fieldValue })
                }}
              />
            ))}
        </div>
      )

    default:
      return null
  }
}

type PositionEditorProps = {
  gridArea: GridArea
  onChange: (gridArea: GridArea) => void
}

function PositionEditor({ gridArea, onChange }: PositionEditorProps) {
  const update = (field: keyof GridArea, value: number) => {
    onChange({ ...gridArea, [field]: Math.max(1, value) })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Column</label>
          <input
            type="number"
            min={1}
            value={gridArea.column}
            onChange={(e) => update("column", Number(e.target.value))}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Col Span</label>
          <input
            type="number"
            min={1}
            value={gridArea.columnSpan}
            onChange={(e) => update("columnSpan", Number(e.target.value))}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Row</label>
          <input
            type="number"
            min={1}
            value={gridArea.row}
            onChange={(e) => update("row", Number(e.target.value))}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Row Span</label>
          <input
            type="number"
            min={1}
            value={gridArea.rowSpan}
            onChange={(e) => update("rowSpan", Number(e.target.value))}
            className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
      <p className="text-xs text-gray-400">
        Drag component edges on the canvas to resize, or drag the component to reposition.
      </p>
    </div>
  )
}

type ResponsiveEditorProps = {
  component: PageComponent
  activeBreakpoint: Breakpoint
  onChange: (updated: PageComponent) => void
}

function ResponsiveEditor({ component, activeBreakpoint, onChange }: ResponsiveEditorProps) {
  if (activeBreakpoint === "desktop") {
    return (
      <div className="text-sm text-gray-400 py-4 text-center">
        Switch to tablet or mobile to set breakpoint overrides.
      </div>
    )
  }

  const bp = activeBreakpoint as "tablet" | "mobile"
  const overrides = component.responsive?.[bp]
  const isHidden = overrides?.hidden ?? false
  const gridOverrides = overrides?.gridArea ?? {}

  const updateOverrides = (patch: Partial<ResponsiveOverrides>) => {
    const currentOverrides = component.responsive?.[bp] ?? {}
    const merged = { ...currentOverrides, ...patch }
    onChange({
      ...component,
      responsive: {
        ...component.responsive,
        [bp]: merged,
      },
    })
  }

  const updateGridOverride = (field: keyof GridArea, value: string) => {
    const numVal = Number(value)
    const currentGrid = overrides?.gridArea ?? {}
    if (value === "" || isNaN(numVal)) {
      // Clear the override
      const { [field]: _, ...rest } = currentGrid
      updateOverrides({ gridArea: Object.keys(rest).length > 0 ? rest : undefined })
    } else {
      updateOverrides({ gridArea: { ...currentGrid, [field]: Math.max(1, numVal) } })
    }
  }

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold text-gray-700">
        Overrides for {activeBreakpoint}
      </h4>

      <label className="flex items-center gap-2 py-1">
        <input
          type="checkbox"
          checked={isHidden}
          onChange={(e) => updateOverrides({ hidden: e.target.checked })}
          className="rounded border-gray-300"
        />
        <span className="text-sm text-gray-700">Hide on {activeBreakpoint}</span>
      </label>

      <div className="space-y-3">
        <h5 className="text-xs font-medium text-gray-500">Grid position overrides</h5>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Column</label>
            <input
              type="number"
              min={1}
              value={gridOverrides.column ?? ""}
              placeholder={String(component.gridArea.column)}
              onChange={(e) => updateGridOverride("column", e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Col Span</label>
            <input
              type="number"
              min={1}
              value={gridOverrides.columnSpan ?? ""}
              placeholder={String(component.gridArea.columnSpan)}
              onChange={(e) => updateGridOverride("columnSpan", e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Row</label>
            <input
              type="number"
              min={1}
              value={gridOverrides.row ?? ""}
              placeholder={String(component.gridArea.row)}
              onChange={(e) => updateGridOverride("row", e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Row Span</label>
            <input
              type="number"
              min={1}
              value={gridOverrides.rowSpan ?? ""}
              placeholder={String(component.gridArea.rowSpan)}
              onChange={(e) => updateGridOverride("rowSpan", e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400">
          Leave blank to inherit the desktop value.
        </p>
      </div>
    </div>
  )
}
