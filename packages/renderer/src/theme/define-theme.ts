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

export type { ThemeDefinition, ThemeSettings, ThemeSettingField, DefinedTheme }
