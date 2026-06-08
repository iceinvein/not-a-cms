import type { CollectionDef, FieldDef } from "../types"

type DocumentValue = Record<string, unknown>

const SYSTEM_FIELDS = new Set(["id", "created_at", "updated_at"])

export function serializeDocumentForStorage(
  collection: CollectionDef,
  doc: DocumentValue,
): DocumentValue {
  const row: DocumentValue = {}

  for (const name of SYSTEM_FIELDS) {
    if (name in doc) {
      row[name] = doc[name]
    }
  }

  for (const [name, fieldDef] of Object.entries(collection.fields)) {
    const storageKey = storageKeyForField(name, fieldDef)
    const value = doc[name] !== undefined ? doc[name] : doc[storageKey]
    if (value !== undefined) row[storageKey] = serializeFieldValue(value, fieldDef)
  }

  return row
}

export function deserializeDocumentFromStorage(
  collection: CollectionDef,
  row: DocumentValue,
): DocumentValue {
  const doc: DocumentValue = {}

  for (const field of SYSTEM_FIELDS) {
    if (field in row) doc[field] = row[field]
  }

  for (const [name, fieldDef] of Object.entries(collection.fields)) {
    const key = storageKeyForField(name, fieldDef)
    if (!(key in row)) continue
    doc[name] = deserializeFieldValue(row[key], fieldDef)
  }

  return doc
}

export function storageKeyForField(name: string, fieldDef: FieldDef): string {
  const snakeName = camelToSnake(name)
  return fieldDef.type === "relation" || fieldDef.type === "media" ? `${snakeName}_id` : snakeName
}

export function serializeFieldValue(value: unknown, fieldDef: FieldDef): unknown {
  if (value === undefined) return undefined
  if (value === null) return null

  if (fieldDef.type === "number" && typeof value === "string" && value.trim() !== "") {
    return Number(value)
  }

  if (fieldDef.type === "boolean") {
    if (typeof value === "string") return value === "true" || value === "1"
    return value ? 1 : 0
  }

  if (fieldDef.type === "relation" || fieldDef.type === "media") {
    return valueId(value)
  }

  if (
    fieldDef.type === "array" ||
    fieldDef.type === "group" ||
    fieldDef.type === "richText" ||
    fieldDef.type === "pageLayout"
  ) {
    return typeof value === "string" ? value : JSON.stringify(value)
  }

  return value
}

export function deserializeFieldValue(value: unknown, fieldDef: FieldDef): unknown {
  if (value === undefined || value === null) return value

  if (fieldDef.type === "boolean") {
    return Boolean(value)
  }

  if (
    fieldDef.type === "array" ||
    fieldDef.type === "group" ||
    fieldDef.type === "richText" ||
    fieldDef.type === "pageLayout"
  ) {
    if (typeof value !== "string") return value
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  return value
}

function valueId(value: unknown): unknown {
  if (isRecord(value) && "id" in value) return value.id
  return value
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

function isRecord(value: unknown): value is DocumentValue {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
