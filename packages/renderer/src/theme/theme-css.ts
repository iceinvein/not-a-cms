import type { DefinedTheme, ThemeSettingField } from "./define-theme"

/** Resolved theme settings: section -> key -> string value (no field metadata). */
export type ResolvedThemeSettings = Record<string, Record<string, string>>

/**
 * Map a theme key to a CSS custom-property suffix (camelCase -> kebab-case).
 */
function kebab(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
}

/**
 * Per-section variable prefixes. Fonts are namespaced (--font-display) so they do
 * not collide with same-named colors; colors and everything else use the bare key.
 */
const SECTION_PREFIX: Record<string, string> = {
  fonts: "font-",
  typography: "font-",
}

/**
 * Flatten a theme's setting fields to their resolved default values, dropping any
 * field without a default. Accepts either a DefinedTheme or the plain `{ settings }`
 * shape the API serves.
 */
export function resolveThemeSettings(theme: Pick<DefinedTheme, "settings"> | null | undefined): ResolvedThemeSettings {
  const resolved: ResolvedThemeSettings = {}
  for (const [section, fields] of Object.entries(theme?.settings ?? {})) {
    for (const [key, field] of Object.entries(fields as Record<string, ThemeSettingField>)) {
      if (field?.default === undefined || field.default === null) continue
      ;(resolved[section] ??= {})[key] = String(field.default)
    }
  }
  return resolved
}

/**
 * Overlay `override` settings onto `base`, section by section. Used so the project's
 * theme (from config.theme) can selectively override the renderer's bundled defaults
 * without having to restate every token.
 */
export function mergeResolvedSettings(base: ResolvedThemeSettings, override: ResolvedThemeSettings): ResolvedThemeSettings {
  const merged: ResolvedThemeSettings = {}
  for (const section of new Set([...Object.keys(base), ...Object.keys(override)])) {
    merged[section] = { ...base[section], ...override[section] }
  }
  return merged
}

/**
 * Render resolved settings as a `:root { ... }` block of CSS custom properties.
 * `fonts.import` is a stylesheet URL for a <link>, not a style value, so it is
 * excluded from the variable block.
 */
export function cssVariablesFromSettings(resolved: ResolvedThemeSettings): string {
  const lines: string[] = []
  for (const [section, values] of Object.entries(resolved)) {
    const prefix = SECTION_PREFIX[section] ?? ""
    for (const [key, value] of Object.entries(values)) {
      if (prefix === "font-" && key === "import") continue
      lines.push(`  --${prefix}${kebab(key)}: ${value};`)
    }
  }
  return `:root {\n${lines.join("\n")}${lines.length ? "\n" : ""}}`
}

/**
 * Render a theme's setting defaults as a `:root { ... }` block of CSS custom
 * properties, so the renderer's stylesheet can be driven by the active theme
 * instead of hardcoded values (F-017). A user who edits the theme's color or font
 * defaults changes the rendered site. Settings without a default are skipped.
 */
export function themeToCssVariables(theme: Pick<DefinedTheme, "settings">): string {
  return cssVariablesFromSettings(resolveThemeSettings(theme))
}
