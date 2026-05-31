import { adminApiUrl, createAdminFetchInit, type AdminApiFetchOptions } from "./api"

export type SchemaCollection = {
  name: string
  labels: { singular: string; plural: string }
  fields: Record<string, any>
}

export async function fetchCollections(options: AdminApiFetchOptions = {}): Promise<SchemaCollection[]> {
  try {
    const res = await fetch(adminApiUrl("/api/_schema"), createAdminFetchInit(options))
    if (!res.ok) return []
    const data = await res.json()
    return data.collections ?? []
  } catch {
    return []
  }
}

export async function fetchCollection(name: string, options: AdminApiFetchOptions = {}): Promise<SchemaCollection | null> {
  try {
    const res = await fetch(adminApiUrl(`/api/_schema/${encodeURIComponent(name)}`), createAdminFetchInit(options))
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
