import { sql } from "drizzle-orm"
import type { AppDatabase } from "../db/connection"

const COLLECTION_SETTINGS_PREFIX = "collection."
const COLLECTION_SETTINGS_SUFFIX = ".settings"
const ACCESS_ACTIONS = ["read", "create", "update", "delete"] as const

export type CollectionAccessSettings = Partial<Record<typeof ACCESS_ACTIONS[number], string[]>>

export type CollectionSettings = {
  labels?: {
    singular?: string
    plural?: string
  }
  access?: CollectionAccessSettings
  previewPath?: string
  searchFields?: string[]
  editorLayout?: string
}

export function createSettingsService(db: AppDatabase) {
  function get(key: string): string | null {
    const rows = db.all(sql`SELECT value FROM _settings WHERE key = ${key}`) as any[]
    return rows[0]?.value ?? null
  }

  function getAll(prefix?: string): Record<string, string> {
    const rows = prefix
      ? db.all(sql`SELECT key, value FROM _settings WHERE key LIKE ${prefix + "%"}`) as any[]
      : db.all(sql`SELECT key, value FROM _settings`) as any[]
    const result: Record<string, string> = {}
    for (const row of rows) result[row.key] = row.value
    return result
  }

  function set(key: string, value: string): void {
    const now = new Date().toISOString()
    db.run(sql`INSERT INTO _settings (key, value, updated_at) VALUES (${key}, ${value}, ${now}) ON CONFLICT(key) DO UPDATE SET value = ${value}, updated_at = ${now}`)
  }

  function remove(key: string): void {
    db.run(sql`DELETE FROM _settings WHERE key = ${key}`)
  }

  function getCollectionSettings(collection: string): CollectionSettings {
    const stored = get(collectionSettingsKey(collection))
    if (!stored) return {}
    try {
      return normalizeCollectionSettings(JSON.parse(stored))
    } catch {
      return {}
    }
  }

  function setCollectionSettings(collection: string, value: CollectionSettings): CollectionSettings {
    const normalized = normalizeCollectionSettings(value)
    set(collectionSettingsKey(collection), JSON.stringify(normalized))
    return normalized
  }

  return { get, getAll, set, remove, getCollectionSettings, setCollectionSettings }
}

export type SettingsService = ReturnType<typeof createSettingsService>

function collectionSettingsKey(collection: string): string {
  return `${COLLECTION_SETTINGS_PREFIX}${collection}${COLLECTION_SETTINGS_SUFFIX}`
}

function normalizeCollectionSettings(input: unknown): CollectionSettings {
  if (!isRecord(input)) return {}
  const result: CollectionSettings = {}

  if (isRecord(input.labels)) {
    const singular = normalizeText(input.labels.singular)
    const plural = normalizeText(input.labels.plural)
    if (singular || plural) {
      result.labels = {
        ...(singular && { singular }),
        ...(plural && { plural }),
      }
    }
  }

  if (isRecord(input.access)) {
    const access: CollectionAccessSettings = {}
    for (const action of ACCESS_ACTIONS) {
      const roles = normalizeStringArray(input.access[action])
      if (roles.length > 0 || action in input.access) access[action] = roles
    }
    if (Object.keys(access).length > 0) result.access = access
  }

  const previewPath = normalizePreviewPath(input.previewPath)
  if (previewPath) result.previewPath = previewPath

  const searchFields = normalizeStringArray(input.searchFields)
  if (searchFields.length > 0) result.searchFields = searchFields

  const editorLayout = normalizeText(input.editorLayout)
  if (editorLayout) result.editorLayout = editorLayout

  return result
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of value) {
    const text = normalizeText(item)
    if (!text || seen.has(text)) continue
    seen.add(text)
    result.push(text)
  }
  return result
}

function normalizePreviewPath(value: unknown): string | undefined {
  const text = normalizeText(value)
  if (!text) return undefined
  return text.startsWith("/") ? text : `/${text}`
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const text = value.trim()
  return text || undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
