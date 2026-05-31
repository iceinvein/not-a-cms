import { sql } from "drizzle-orm"
import type { AppDatabase } from "../db/connection"

export type AuditAction = "content.created" | "content.updated" | "content.deleted" | string

export type AuditEventInput = {
  action: AuditAction
  actorId?: string | null
  actorRole?: string | null
  collection?: string | null
  documentId?: string | null
  summary?: string | null
  before?: unknown
  after?: unknown
}

export type AuditEvent = {
  id: string
  action: AuditAction
  actorId: string | null
  actorRole: string | null
  collection: string | null
  documentId: string | null
  summary: string | null
  before: unknown
  after: unknown
  createdAt: string
}

export type AuditListOptions = {
  collection?: string
  documentId?: string
  limit?: number
  offset?: number
}

type AuditRow = {
  id: string
  action: string
  actor_id: string | null
  actor_role: string | null
  collection: string | null
  document_id: string | null
  summary: string | null
  before_data: string | null
  after_data: string | null
  created_at: string
}

export function createAuditLogStore(db: AppDatabase) {
  function record(input: AuditEventInput): AuditEvent {
    const id = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    db.run(sql`INSERT INTO _audit_log (
      id, action, actor_id, actor_role, collection, document_id, summary, before_data, after_data, created_at
    ) VALUES (
      ${id},
      ${input.action},
      ${input.actorId ?? null},
      ${input.actorRole ?? null},
      ${input.collection ?? null},
      ${input.documentId ?? null},
      ${input.summary ?? null},
      ${serialize(input.before)},
      ${serialize(input.after)},
      ${createdAt}
    )`)

    return {
      id,
      action: input.action,
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      collection: input.collection ?? null,
      documentId: input.documentId ?? null,
      summary: input.summary ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
      createdAt,
    }
  }

  function list(options: AuditListOptions = {}): AuditEvent[] {
    const limit = options.limit ?? 50
    const offset = options.offset ?? 0
    const rows = queryRows(options, limit, offset)
    return rows.map(fromRow)
  }

  function queryRows(options: AuditListOptions, limit: number, offset: number): AuditRow[] {
    if (options.collection && options.documentId) {
      return db.all(sql`SELECT * FROM _audit_log WHERE collection = ${options.collection} AND document_id = ${options.documentId} ORDER BY created_at DESC, rowid DESC LIMIT ${limit} OFFSET ${offset}`) as AuditRow[]
    }
    if (options.collection) {
      return db.all(sql`SELECT * FROM _audit_log WHERE collection = ${options.collection} ORDER BY created_at DESC, rowid DESC LIMIT ${limit} OFFSET ${offset}`) as AuditRow[]
    }
    if (options.documentId) {
      return db.all(sql`SELECT * FROM _audit_log WHERE document_id = ${options.documentId} ORDER BY created_at DESC, rowid DESC LIMIT ${limit} OFFSET ${offset}`) as AuditRow[]
    }
    return db.all(sql`SELECT * FROM _audit_log ORDER BY created_at DESC, rowid DESC LIMIT ${limit} OFFSET ${offset}`) as AuditRow[]
  }

  return { record, list }
}

function serialize(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value)
}

function parse(value: string | null): unknown {
  if (value === null) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function fromRow(row: AuditRow): AuditEvent {
  return {
    id: row.id,
    action: row.action,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    collection: row.collection,
    documentId: row.document_id,
    summary: row.summary,
    before: parse(row.before_data),
    after: parse(row.after_data),
    createdAt: row.created_at,
  }
}

export type AuditLogStore = ReturnType<typeof createAuditLogStore>
