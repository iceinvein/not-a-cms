import { sql } from "drizzle-orm"
import type { AppDatabase } from "../db/connection"

const DEFAULT_TTL_HOURS = 72

export function createPreviewTokenService(db: AppDatabase) {
  function generate(collection: string, documentId: string, ttlHours = DEFAULT_TTL_HOURS) {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString()

    const existing = db.all(sql`SELECT * FROM _preview_tokens WHERE collection = ${collection} AND document_id = ${documentId} AND expires_at > ${now.toISOString()}`) as any[]
    if (existing.length > 0) {
      return { token: existing[0].token, collection, document_id: documentId, expires_at: existing[0].expires_at }
    }

    const token = crypto.randomUUID() + "-" + crypto.randomUUID()
    const id = crypto.randomUUID()
    db.run(sql`INSERT INTO _preview_tokens (id, token, collection, document_id, expires_at, created_at) VALUES (${id}, ${token}, ${collection}, ${documentId}, ${expiresAt}, ${now.toISOString()})`)
    return { token, collection, document_id: documentId, expires_at: expiresAt }
  }

  function validate(token: string): { collection: string; document_id: string } | null {
    const now = new Date().toISOString()
    const rows = db.all(sql`SELECT * FROM _preview_tokens WHERE token = ${token} AND expires_at > ${now}`) as any[]
    if (rows.length === 0) return null
    return { collection: rows[0].collection, document_id: rows[0].document_id }
  }

  return { generate, validate }
}

export type PreviewTokenService = ReturnType<typeof createPreviewTokenService>
