import { sql } from "drizzle-orm"
import type { AppDatabase } from "../db/connection"

const DEFAULT_TTL_HOURS = 72

type GenerateOptions = {
  ttlHours?: number
  regenerate?: boolean
}

type ValidateOptions = {
  collection?: string
  documentId?: string
}

type PreviewTokenRecord = {
  token: string
  collection: string
  document_id: string
  expires_at: string
}

export function createPreviewTokenService(db: AppDatabase) {
  function generate(
    collection: string,
    documentId: string,
    opts: number | GenerateOptions = DEFAULT_TTL_HOURS,
  ): PreviewTokenRecord {
    const options = normalizeGenerateOptions(opts)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + options.ttlHours * 60 * 60 * 1000).toISOString()

    if (options.regenerate) {
      revoke(collection, documentId, now)
    } else {
      const existing = db.all(sql`
        SELECT * FROM _preview_tokens
        WHERE collection = ${collection}
          AND document_id = ${documentId}
          AND expires_at > ${now.toISOString()}
          AND revoked_at IS NULL
      `) as any[]
      if (existing.length > 0) {
        return {
          token: existing[0].token,
          collection,
          document_id: documentId,
          expires_at: existing[0].expires_at,
        }
      }
    }

    const token = crypto.randomUUID() + "-" + crypto.randomUUID()
    const id = crypto.randomUUID()
    db.run(
      sql`INSERT INTO _preview_tokens (id, token, collection, document_id, expires_at, revoked_at, created_at) VALUES (${id}, ${token}, ${collection}, ${documentId}, ${expiresAt}, NULL, ${now.toISOString()})`,
    )
    return { token, collection, document_id: documentId, expires_at: expiresAt }
  }

  function validate(
    token: string,
    opts: ValidateOptions = {},
  ): { collection: string; document_id: string } | null {
    const now = new Date().toISOString()
    const rows = db.all(sql`
      SELECT * FROM _preview_tokens
      WHERE token = ${token}
        AND expires_at > ${now}
        AND revoked_at IS NULL
    `) as any[]
    if (rows.length === 0) return null
    if (opts.collection && rows[0].collection !== opts.collection) return null
    if (opts.documentId && rows[0].document_id !== opts.documentId) return null
    return { collection: rows[0].collection, document_id: rows[0].document_id }
  }

  function revoke(collection: string, documentId: string, now = new Date()): number {
    const active = db.all(sql`
      SELECT id FROM _preview_tokens
      WHERE collection = ${collection}
        AND document_id = ${documentId}
        AND revoked_at IS NULL
    `) as any[]
    db.run(sql`
      UPDATE _preview_tokens
      SET revoked_at = ${now.toISOString()}
      WHERE collection = ${collection}
        AND document_id = ${documentId}
        AND revoked_at IS NULL
    `)
    return active.length
  }

  return { generate, validate, revoke }
}

export type PreviewTokenService = ReturnType<typeof createPreviewTokenService>

function normalizeGenerateOptions(opts: number | GenerateOptions): Required<GenerateOptions> {
  if (typeof opts === "number") {
    return { ttlHours: opts, regenerate: false }
  }
  return {
    ttlHours: opts.ttlHours ?? DEFAULT_TTL_HOURS,
    regenerate: opts.regenerate ?? false,
  }
}
