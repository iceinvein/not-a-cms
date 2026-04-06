function escapeClassName(name: string): string {
  return name.replace(/([^a-zA-Z0-9_-])/g, "\\$1")
}

export function compileStyles(styles: Record<string, Record<string, string>>): string {
  const entries = Object.entries(styles)
  if (entries.length === 0) return ""

  return entries
    .map(([className, properties]) => {
      const props = Object.entries(properties)
        .map(([prop, value]) => `${prop}:${value}`)
        .join(";")
      return `.${escapeClassName(className)}{${props}}`
    })
    .join("\n")
}

export function compileInlineStyle(styles: Record<string, string>): string {
  return Object.entries(styles)
    .map(([prop, value]) => `${prop}:${value}`)
    .join(";")
}
