import type { DefinedTheme, ThemeSettingField } from "./define-theme"

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
 * Render a theme's setting defaults as a `:root { ... }` block of CSS custom
 * properties, so the renderer's stylesheet can be driven by the active theme
 * instead of hardcoded values (F-017). A user who edits the theme's color or font
 * defaults changes the rendered site. Settings without a default are skipped.
 */
export function themeToCssVariables(theme: Pick<DefinedTheme, "settings">): string {
  const lines: string[] = []
  for (const [section, fields] of Object.entries(theme.settings ?? {})) {
    const prefix = SECTION_PREFIX[section] ?? ""
    for (const [key, field] of Object.entries(fields as Record<string, ThemeSettingField>)) {
      if (field.default === undefined || field.default === null) continue
      lines.push(`  --${prefix}${kebab(key)}: ${String(field.default)};`)
    }
  }
  return `:root {\n${lines.join("\n")}${lines.length ? "\n" : ""}}`
}
