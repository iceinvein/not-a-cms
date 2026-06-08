import type { AskContext, AskProvider, EmbeddingStore } from "@not-a-cms/core"

export type AskHit = {
  collection: string
  documentId: string
  title: string
  href: string
}

export type AskResult = {
  data: AskHit[]
  answer?: string
}

type FtsHit = {
  collection: string
  document_id: string
}

type ResolvedHit = {
  title: string
  text: string
  href: string
}

type RunAskDeps = {
  q: string
  provider?: AskProvider
  embeddings?: EmbeddingStore
  topK?: number
  collection?: string
  fts: (q: string, collection?: string) => FtsHit[]
  resolve: (collection: string, documentId: string) => Promise<ResolvedHit | null>
}

export async function runAsk({
  q,
  provider,
  embeddings,
  topK = 8,
  collection,
  fts,
  resolve,
}: RunAskDeps): Promise<AskResult> {
  const trimmed = q.trim()
  if (!trimmed) return { data: [] }

  const rawHits =
    provider && embeddings
      ? embeddings.search(
          new Float32Array((await provider.embed([trimmed]))[0] ?? []),
          topK,
          collection,
        )
      : fts(trimmed, collection).slice(0, topK)

  const data: AskHit[] = []
  const contexts: AskContext[] = []

  for (const hit of rawHits) {
    const resolved = await resolve(hit.collection, hit.document_id)
    if (!resolved) continue
    data.push({
      collection: hit.collection,
      documentId: hit.document_id,
      title: resolved.title,
      href: resolved.href,
    })
    contexts.push({
      title: resolved.title,
      text: resolved.text,
      href: resolved.href,
    })
  }

  const answer =
    provider?.synthesize && contexts.length > 0
      ? await provider.synthesize(trimmed, contexts)
      : undefined

  return answer ? { data, answer } : { data }
}
