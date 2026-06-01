import { adminApiFetch } from "../api"
import type { ContentHit } from "./content-search"

type AskApiHit = {
  collection: string
  documentId: string
  title: string
  href: string
}

type AskApiResponse = {
  data?: AskApiHit[]
  answer?: string
}

type Fetcher = (path: string) => Promise<AskApiResponse>

function defaultFetcher(apiBase: string): Fetcher {
  return async (path) => {
    const res = await adminApiFetch(apiBase, path)
    if (!res.ok) throw new Error(`ask failed: ${res.status}`)
    return res.json()
  }
}

export async function askContent(
  apiBase: string,
  query: string,
  fetcher: Fetcher = defaultFetcher(apiBase),
): Promise<{ hits: ContentHit[]; answer?: string }> {
  const q = query.trim()
  if (!q) return { hits: [] }

  const params = new URLSearchParams({ q })
  const body = await fetcher(`/api/_ask?${params.toString()}`)
  const hits = (body.data ?? []).map<ContentHit>((row) => ({
    collection: row.collection,
    collectionLabel: row.collection,
    documentId: row.documentId,
    title: row.title,
    href: row.href,
  }))

  return body.answer ? { hits, answer: body.answer } : { hits }
}
