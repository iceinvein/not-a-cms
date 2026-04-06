import { sql } from "drizzle-orm"
import type { AppDatabase } from "../db/connection"

type SearchResult = {
  collection: string
  document_id: string
  rank: number
}

export function createSearchService(db: AppDatabase) {
  function index(collection: string, documentId: string, title: string, bodyText: string) {
    db.run(
      sql`DELETE FROM content_fts WHERE collection = ${collection} AND document_id = ${documentId}`,
    )
    db.run(
      sql`INSERT INTO content_fts (collection, document_id, title, body_text) VALUES (${collection}, ${documentId}, ${title}, ${bodyText})`,
    )
  }

  function update(collection: string, documentId: string, title: string, bodyText: string) {
    index(collection, documentId, title, bodyText)
  }

  function remove(collection: string, documentId: string) {
    db.run(
      sql`DELETE FROM content_fts WHERE collection = ${collection} AND document_id = ${documentId}`,
    )
  }

  function query(searchTerm: string, collection?: string): SearchResult[] {
    const ftsQuery = searchTerm.trim().split(/\s+/).map(t => `"${t}"*`).join(" ")

    let sqlQuery
    if (collection) {
      sqlQuery = sql`SELECT collection, document_id, rank FROM content_fts WHERE content_fts MATCH ${ftsQuery} AND collection = ${collection} ORDER BY rank LIMIT 50`
    } else {
      sqlQuery = sql`SELECT collection, document_id, rank FROM content_fts WHERE content_fts MATCH ${ftsQuery} ORDER BY rank LIMIT 50`
    }

    const rows = db.all<SearchResult>(sqlQuery)
    return rows as SearchResult[]
  }

  return { index, update, remove, query }
}

/**
 * Extract plain text from Portable Text JSON for FTS indexing.
 * Walks the block tree and concatenates all text node values.
 */
export function extractTextFromPortableText(blocks: unknown): string {
  if (!blocks) return ""
  if (typeof blocks === "string") {
    try {
      blocks = JSON.parse(blocks)
    } catch {
      return blocks as string
    }
  }
  if (!Array.isArray(blocks)) return ""

  const parts: string[] = []
  function walk(node: any) {
    if (!node) return
    if (typeof node === "string") { parts.push(node); return }
    if (node.value && typeof node.value === "string") parts.push(node.value)
    if (node.text && typeof node.text === "string") parts.push(node.text)
    if (Array.isArray(node.children)) node.children.forEach(walk)
    if (Array.isArray(node.items)) node.items.forEach((item: any) => {
      if (Array.isArray(item)) item.forEach(walk)
      else walk(item)
    })
  }
  for (const block of blocks as any[]) walk(block)
  return parts.join(" ")
}

export type SearchService = ReturnType<typeof createSearchService>
export type { SearchResult }
