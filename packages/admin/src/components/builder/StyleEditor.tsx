import { useState } from "react"
import type { StyleOverrides } from "../../lib/builder-types"

type StyleEditorProps = {
  style: StyleOverrides | undefined
  onChange: (style: StyleOverrides) => void
}

type StyleCategory = "layout" | "spacing" | "typography" | "background" | "border"

type PropertyDef = {
  prop: string
  label: string
  type: "number" | "select" | "color" | "text"
  unit?: string
  options?: string[]
}

const CATEGORIES: Record<StyleCategory, { label: string; properties: PropertyDef[] }> = {
  layout: {
    label: "Layout",
    properties: [
      { prop: "display", label: "Display", type: "select", options: ["block", "flex", "grid", "inline", "none"] },
      { prop: "flex-direction", label: "Direction", type: "select", options: ["row", "column", "row-reverse", "column-reverse"] },
      { prop: "justify-content", label: "Justify", type: "select", options: ["flex-start", "center", "flex-end", "space-between", "space-around", "space-evenly"] },
      { prop: "align-items", label: "Align", type: "select", options: ["stretch", "flex-start", "center", "flex-end", "baseline"] },
      { prop: "gap", label: "Gap", type: "number", unit: "px" },
    ],
  },
  spacing: {
    label: "Spacing",
    properties: [
      { prop: "padding-top", label: "Pad Top", type: "number", unit: "px" },
      { prop: "padding-right", label: "Pad Right", type: "number", unit: "px" },
      { prop: "padding-bottom", label: "Pad Bottom", type: "number", unit: "px" },
      { prop: "padding-left", label: "Pad Left", type: "number", unit: "px" },
      { prop: "margin-top", label: "Margin Top", type: "number", unit: "px" },
      { prop: "margin-bottom", label: "Margin Bottom", type: "number", unit: "px" },
    ],
  },
  typography: {
    label: "Typography",
    properties: [
      { prop: "font-size", label: "Font Size", type: "number", unit: "px" },
      { prop: "font-weight", label: "Weight", type: "select", options: ["300", "400", "500", "600", "700", "800"] },
      { prop: "line-height", label: "Line Height", type: "number" },
      { prop: "text-align", label: "Align", type: "select", options: ["left", "center", "right", "justify"] },
      { prop: "color", label: "Color", type: "color" },
    ],
  },
  background: {
    label: "Background",
    properties: [
      { prop: "background-color", label: "Color", type: "color" },
      { prop: "background-image", label: "Image URL", type: "text" },
      { prop: "background-size", label: "Size", type: "select", options: ["cover", "contain", "auto"] },
    ],
  },
  border: {
    label: "Border",
    properties: [
      { prop: "border-radius", label: "Radius", type: "number", unit: "px" },
      { prop: "border-width", label: "Width", type: "number", unit: "px" },
      { prop: "border-color", label: "Color", type: "color" },
      { prop: "border-style", label: "Style", type: "select", options: ["none", "solid", "dashed", "dotted"] },
    ],
  },
}

const CATEGORY_KEYS: StyleCategory[] = ["layout", "spacing", "typography", "background", "border"]

const inputClass = "w-full px-2.5 py-1.5 border border-[rgba(255,255,255,0.1)] rounded text-sm bg-transparent text-[#fafafa] placeholder:text-[#52525b] focus:outline-none focus:border-[#c9956b] focus:ring-0"

function readValue(styles: Record<string, string> | undefined, prop: string, unit?: string): string {
  const raw = styles?.[prop] ?? ""
  if (!raw) return ""
  if (unit && raw.endsWith(unit)) {
    return raw.slice(0, -unit.length)
  }
  return raw
}

export function StyleEditor({ style, onChange }: StyleEditorProps) {
  const [activeTab, setActiveTab] = useState<StyleCategory>("layout")
  const styles = style?.styles ?? {}

  const updateProperty = (prop: string, value: string, unit?: string) => {
    const newStyles = { ...styles }
    if (value === "") {
      delete newStyles[prop]
    } else {
      newStyles[prop] = unit ? `${value}${unit}` : value
    }
    onChange({ ...style, styles: newStyles })
  }

  const category = CATEGORIES[activeTab]

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-[rgba(255,255,255,0.06)]">
        {CATEGORY_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-2.5 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? "border-[#fafafa] text-[#fafafa]"
                : "border-transparent text-[#71717a] hover:text-[#a1a1aa]"
            }`}
          >
            {CATEGORIES[key].label}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {category.properties.map((def) => (
          <PropertyField
            key={def.prop}
            def={def}
            value={readValue(styles, def.prop, def.unit)}
            onChange={(val) => updateProperty(def.prop, val, def.unit)}
          />
        ))}
      </div>
    </div>
  )
}

type PropertyFieldProps = {
  def: PropertyDef
  value: string
  onChange: (value: string) => void
}

function PropertyField({ def, value, onChange }: PropertyFieldProps) {
  switch (def.type) {
    case "number":
      return (
        <div>
          <label className="block text-xs font-medium text-[#71717a] mb-1">{def.label}</label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className={inputClass}
            />
            {def.unit && <span className="text-xs text-[#52525b] shrink-0">{def.unit}</span>}
          </div>
        </div>
      )

    case "select":
      return (
        <div>
          <label className="block text-xs font-medium text-[#71717a] mb-1">{def.label}</label>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          >
            <option value="">--</option>
            {def.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )

    case "color":
      return (
        <div>
          <label className="block text-xs font-medium text-[#71717a] mb-1">{def.label}</label>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={value || "#000000"}
              onChange={(e) => onChange(e.target.value)}
              className="w-8 h-8 rounded border border-[rgba(255,255,255,0.1)] cursor-pointer p-0.5 bg-transparent"
            />
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="#000000"
              className={"flex-1 px-2.5 py-1.5 border border-[rgba(255,255,255,0.1)] rounded text-sm bg-transparent text-[#fafafa] placeholder:text-[#52525b] focus:outline-none focus:border-[#c9956b] focus:ring-0"}
            />
          </div>
        </div>
      )

    case "text":
      return (
        <div>
          <label className="block text-xs font-medium text-[#71717a] mb-1">{def.label}</label>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={def.prop === "background-image" ? "url(...)" : ""}
            className={inputClass}
          />
        </div>
      )

    default:
      return null
  }
}
