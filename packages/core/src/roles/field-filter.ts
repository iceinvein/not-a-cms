import type { CollectionDef, FieldDef } from "../types"

type DocumentValue = Record<string, unknown>
export type CollectionAction = "read" | "create" | "update" | "delete"

const defaultCollectionAccess: Record<CollectionAction, string[] | null> = {
  read: null,
  create: ["admin", "editor", "author"],
  update: ["admin", "editor", "author"],
  delete: ["admin", "editor"],
}

export function canAccessCollection(collection: CollectionDef, role: string, action: CollectionAction): boolean {
  const allowedRoles = collection.access?.[action] ?? defaultCollectionAccess[action]
  return !allowedRoles || allowedRoles.includes(role)
}

export function canReadField(fieldDef: FieldDef, role: string): boolean {
  return !fieldDef.access?.read || fieldDef.access.read.includes(role)
}

export function canWriteField(fieldDef: FieldDef, role: string): boolean {
  return !fieldDef.access?.write || fieldDef.access.write.includes(role)
}

export function filterFieldsByRole(fields: Record<string, FieldDef>, role: string): Record<string, FieldDef> {
  const result: Record<string, FieldDef> = {}
  for (const [name, fieldDef] of Object.entries(fields)) {
    // Only read restrictions gate visibility
    if (!canReadField(fieldDef, role)) continue
    result[name] = fieldDef
  }
  return result
}

export function projectDocumentFields<T extends DocumentValue>(
  doc: T,
  fields: Record<string, FieldDef>,
  role: string,
): Partial<T> {
  const result: DocumentValue = {}

  for (const [name, value] of Object.entries(doc)) {
    const fieldDef = fields[name]
    if (!fieldDef) {
      result[name] = value
      continue
    }

    if (!canReadField(fieldDef, role)) continue
    result[name] = projectFieldValue(value, fieldDef, role, "read")
  }

  return result as Partial<T>
}

export function filterWritableFields<T extends DocumentValue>(
  input: T,
  fields: Record<string, FieldDef>,
  role: string,
): Partial<T> {
  const result: DocumentValue = {}

  for (const [name, value] of Object.entries(input)) {
    const fieldDef = fields[name]
    if (!fieldDef) {
      result[name] = value
      continue
    }

    if (!canWriteField(fieldDef, role)) continue
    result[name] = projectFieldValue(value, fieldDef, role, "write")
  }

  return result as Partial<T>
}

function projectFieldValue(
  value: unknown,
  fieldDef: FieldDef,
  role: string,
  mode: "read" | "write",
): unknown {
  if (fieldDef.type === "group" && isRecord(value)) {
    return mode === "read"
      ? projectDocumentFields(value, fieldDef.fields, role)
      : filterWritableFields(value, fieldDef.fields, role)
  }

  if (fieldDef.type === "array" && Array.isArray(value)) {
    return value.map((item) => projectFieldValue(item, fieldDef.items, role, mode))
  }

  return value
}

function isRecord(value: unknown): value is DocumentValue {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
