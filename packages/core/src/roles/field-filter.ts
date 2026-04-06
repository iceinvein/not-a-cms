import type { FieldDef } from "../types"

export function filterFieldsByRole(fields: Record<string, FieldDef>, role: string): Record<string, FieldDef> {
  const result: Record<string, FieldDef> = {}
  for (const [name, fieldDef] of Object.entries(fields)) {
    // Only read restrictions gate visibility
    if (fieldDef.access?.read && !fieldDef.access.read.includes(role)) continue
    result[name] = fieldDef
  }
  return result
}
