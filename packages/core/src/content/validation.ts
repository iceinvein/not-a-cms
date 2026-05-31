import type { CollectionDef, FieldDef } from "../types"

export type ValidationIssue = {
  path: string
  message: string
}

export class ValidationError extends Error {
  issues: ValidationIssue[]

  constructor(issues: ValidationIssue[]) {
    super("Validation failed")
    this.name = "ValidationError"
    this.issues = issues
  }
}

type DocumentValue = Record<string, unknown>

export function applyDefaultsAndValidate(collection: CollectionDef, input: DocumentValue): DocumentValue {
  const doc = applyDefaults(input, collection.fields)
  const issues = validateFields(doc, collection.fields)
  if (issues.length > 0) {
    throw new ValidationError(issues)
  }
  return doc
}

function applyDefaults(input: DocumentValue, fields: Record<string, FieldDef>): DocumentValue {
  const doc: DocumentValue = { ...input }

  for (const [name, fieldDef] of Object.entries(fields)) {
    if (doc[name] === undefined && "default" in fieldDef && fieldDef.default !== undefined) {
      doc[name] = fieldDef.default
    }

    if (fieldDef.type === "group" && isRecord(doc[name])) {
      doc[name] = applyDefaults(doc[name] as DocumentValue, fieldDef.fields)
    }
  }

  return doc
}

function validateFields(doc: DocumentValue, fields: Record<string, FieldDef>, prefix = ""): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const [name, fieldDef] of Object.entries(fields)) {
    const path = prefix ? `${prefix}.${name}` : name
    const value = doc[name]

    if (isMissingRequiredValue(value, fieldDef)) {
      issues.push({ path, message: "Required field is missing" })
      continue
    }

    if (fieldDef.type === "group") {
      if (value === undefined || value === null) continue
      if (!isRecord(value)) {
        issues.push({ path, message: "Expected an object" })
        continue
      }
      issues.push(...validateFields(value, fieldDef.fields, path))
    }
  }

  return issues
}

function isMissingRequiredValue(value: unknown, fieldDef: FieldDef): boolean {
  if (!fieldDef.required) return false
  if (value === undefined || value === null) return true
  if (typeof value === "string" && value.trim() === "") return true
  return false
}

function isRecord(value: unknown): value is DocumentValue {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
