/** A theme component override: renders props to an HTML string. */
export type ComponentRenderer = (props: Record<string, unknown>) => string
export type ComponentRendererMap = Record<string, ComponentRenderer>

type ThemeSettingField = {
  type: "color" | "text" | "select" | "boolean" | "media" | "array"
  default?: unknown
  label?: string
  options?: string[]
  of?: Record<string, string>
}

type ThemeSettings = Record<string, Record<string, ThemeSettingField>>

type ThemeDefinition = {
  name: string
  version: string
  description?: string
  author?: string
  settings?: ThemeSettings
  components?: ComponentRendererMap
  layouts?: Record<string, string>
  styles?: string[]
}

type DefinedTheme = ThemeDefinition & {
  getDefault: (section: string, key: string) => unknown
}

export function defineTheme(def: ThemeDefinition): DefinedTheme {
  return {
    ...def,
    getDefault(section: string, key: string): unknown {
      return def.settings?.[section]?.[key]?.default ?? null
    },
  }
}

export type { DefinedTheme, ThemeDefinition, ThemeSettingField, ThemeSettings }
