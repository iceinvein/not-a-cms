import type { CollectionDef } from "../types"
import { canAccessCollection, projectDocumentFields } from "../roles/field-filter"
import { QueryError } from "./service"

export type PopulationCollection = {
  def: CollectionDef
  service: {
    findById: (id: string) => Promise<Record<string, unknown> | null>
  }
}

export type MediaPopulationResolver = {
  get: (id: string) => Record<string, unknown> | null | Promise<Record<string, unknown> | null>
}

export type PopulateOptions = {
  populate: string[]
  role: string
  collections: Map<string, PopulationCollection>
  media?: MediaPopulationResolver
}

export async function populateDocuments<T extends Record<string, unknown>>(
  docs: T[],
  collection: CollectionDef,
  options: PopulateOptions,
): Promise<T[]> {
  if (options.populate.length === 0 || docs.length === 0) return docs

  const fields = normalizePopulateFields(collection, options.populate)
  return Promise.all(docs.map((doc) => populateDocument(doc, collection, fields, options)))
}

export async function populateDocument<T extends Record<string, unknown>>(
  doc: T,
  collection: CollectionDef,
  populate: string[],
  options: Omit<PopulateOptions, "populate">,
): Promise<T> {
  if (populate.length === 0) return doc

  const fields = normalizePopulateFields(collection, populate)
  const next: Record<string, unknown> = { ...doc }

  for (const fieldName of fields) {
    const fieldDef = collection.fields[fieldName]
    const value = idFromValue(next[fieldName])

    if (!value) {
      next[fieldName] = null
      continue
    }

    if (fieldDef.type === "relation") {
      const target = options.collections.get(fieldDef.target)
      if (!target || !canAccessCollection(target.def, options.role, "read")) {
        next[fieldName] = null
        continue
      }

      const related = await target.service.findById(value)
      next[fieldName] = related ? projectDocumentFields(related, target.def.fields, options.role) : null
      continue
    }

    if (fieldDef.type === "media") {
      next[fieldName] = options.media ? await options.media.get(value) : null
    }
  }

  return next as T
}

function normalizePopulateFields(collection: CollectionDef, populate: string[]): string[] {
  const unique = new Set<string>()
  for (const fieldName of populate.map((field) => field.trim()).filter(Boolean)) {
    const fieldDef = collection.fields[fieldName]
    if (!fieldDef) throw new QueryError(`Unknown populate field "${fieldName}" in collection "${collection.name}"`)
    if (fieldDef.type !== "relation" && fieldDef.type !== "media") {
      throw new QueryError(`Field "${fieldName}" cannot be populated`)
    }
    unique.add(fieldName)
  }
  return Array.from(unique)
}

function idFromValue(value: unknown): string | null {
  if (!value) return null
  if (typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string") {
    return (value as { id: string }).id
  }
  return String(value)
}
