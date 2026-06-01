import { adminApiFetch } from "../api"

type CrumbCollection = {
  name: string
  label?: string
  labels?: { singular: string; plural: string }
}

export type ContentHit = {
  collection: string
  collectionLabel: string
  documentId: string
  title: string
  status?: string
  href: string
}

type DocRow = { id: string; title?: string; name?: string; slug?: string; status?: string }

type Fetcher = (path: string) => Promise<{ data?: DocRow[] }>

const PER_COLLECTION_LIMIT = 5

function docTitle(row: DocRow): string {
  return String(row.title || row.name || row.slug || row.id)
}

function defaultFetcher(apiBase: string): Fetcher {
  return async (path) => {
    const res = await adminApiFetch(apiBase, path)
    if (!res.ok) throw new Error(`search failed: ${res.status}`)
    return res.json()
  }
}

export async function searchContent(
  apiBase: string,
  collections: CrumbCollection[],
  query: string,
  fetcher: Fetcher = defaultFetcher(apiBase),
): Promise<ContentHit[]> {
  const q = query.trim()
  if (!q) return []

  const results = await Promise.allSettled(
    collections.map(async (c) => {
      const params = new URLSearchParams({ search: q, limit: String(PER_COLLECTION_LIMIT) })
      const body = await fetcher(`/api/${c.name}?${params.toString()}`)
      const label = c.labels?.plural ?? c.label ?? c.name
      return (body.data ?? []).map<ContentHit>((row) => ({
        collection: c.name,
        collectionLabel: label,
        documentId: String(row.id),
        title: docTitle(row),
        status: row.status,
        href: `/content/${c.name}/${row.id}`,
      }))
    }),
  )

  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []))
}
