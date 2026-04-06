const API_BASE = "http://localhost:4321"

export type SchemaCollection = {
  name: string
  labels: { singular: string; plural: string }
  fields: Record<string, any>
}

export async function fetchCollections(): Promise<SchemaCollection[]> {
  try {
    const res = await fetch(`${API_BASE}/api/_schema`)
    if (!res.ok) return []
    const data = await res.json()
    return data.collections ?? []
  } catch {
    return []
  }
}

export async function fetchCollection(name: string): Promise<SchemaCollection | null> {
  try {
    const res = await fetch(`${API_BASE}/api/_schema/${name}`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
