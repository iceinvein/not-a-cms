import { adminApiFetch } from "./api"
import type { RoleDefinition } from "./access"

export type CollectionAccessSettings = Partial<Record<"read" | "create" | "update" | "delete", string[]>>

export type CollectionSettingsInput = {
  labels?: {
    singular?: string
    plural?: string
  }
  access?: CollectionAccessSettings
  previewPath?: string
  searchFields?: string[]
  editorLayout?: string
}

export type CollectionSettingsEntry = {
  name: string
  labels: {
    singular: string
    plural: string
  }
  fields: Record<string, { type: string; [key: string]: unknown }>
  settings: CollectionSettingsInput
}

export type CollectionSettingsResponse = {
  data: CollectionSettingsEntry[]
  roles: RoleDefinition[]
}

export async function listCollectionSettings(apiBase: string): Promise<CollectionSettingsResponse> {
  const res = await adminApiFetch(apiBase, "/api/_collection-settings")
  if (!res.ok) throw new Error("Failed to load collection settings")
  const body = await res.json()
  return {
    data: Array.isArray(body.data) ? body.data : [],
    roles: Array.isArray(body.roles) ? body.roles : [],
  }
}

export async function saveCollectionSettings(
  apiBase: string,
  collection: string,
  settings: CollectionSettingsInput,
): Promise<CollectionSettingsEntry> {
  const res = await adminApiFetch(apiBase, `/api/_collection-settings/${encodeURIComponent(collection)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  })
  if (!res.ok) throw new Error("Failed to save collection settings")
  return res.json()
}
