export type AdminFieldDef = {
  type: string
  required?: boolean
  maxLength?: number
  options?: string[]
  default?: unknown
  from?: string
  target?: string
  accept?: string[]
  items?: AdminFieldDef
  fields?: Record<string, AdminFieldDef>
  [key: string]: unknown
}

export function emptyValueForField(field: AdminFieldDef): unknown {
  if (field.default !== undefined) return field.default

  switch (field.type) {
    case "number":
      return 0
    case "boolean":
      return false
    case "media":
    case "relation":
      return null
    case "array":
      return []
    case "group": {
      const value: Record<string, unknown> = {}
      for (const [name, child] of Object.entries(field.fields ?? {})) {
        value[name] = emptyValueForField(child)
      }
      return value
    }
    default:
      return ""
  }
}

export function coerceArrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function addArrayItem(value: unknown, itemField: AdminFieldDef): unknown[] {
  return [...coerceArrayValue(value), emptyValueForField(itemField)]
}

export function removeArrayItem(value: unknown, index: number): unknown[] {
  return coerceArrayValue(value).filter((_, itemIndex) => itemIndex !== index)
}

export function updateArrayItem(value: unknown, index: number, itemValue: unknown): unknown[] {
  return coerceArrayValue(value).map((existing, itemIndex) => itemIndex === index ? itemValue : existing)
}

export function prepareValueForField(value: unknown, field: AdminFieldDef): unknown {
  if (value === undefined) return value

  switch (field.type) {
    case "media":
    case "relation":
      return valueId(value)
    case "array":
      return coerceArrayValue(value).map((item) => field.items ? prepareValueForField(item, field.items) : item)
    case "group": {
      if (!isRecord(value)) return value
      const prepared: Record<string, unknown> = {}
      for (const [name, child] of Object.entries(field.fields ?? {})) {
        prepared[name] = prepareValueForField(value[name], child)
      }
      return prepared
    }
    default:
      return value
  }
}

export function formatDateTimeInput(value: unknown): string {
  if (!value) return ""
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 16)
}

export function parseDateTimeInput(value: string): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString()
}

function valueId(value: unknown): unknown {
  if (isRecord(value) && "id" in value) return value.id
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
