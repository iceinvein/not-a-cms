import { createHash, randomBytes, randomUUID } from "node:crypto"
import { sql } from "drizzle-orm"
import type { AppDatabase } from "../db/connection"

export type InviteInput = {
  email: string
  role: string
  expiresAt?: Date | string
}

export type InviteRecord = {
  id: string
  email: string
  role: string
  tokenHash: string
  expiresAt: string
  acceptedAt: string | null
  acceptedUserId: string | null
  revokedAt: string | null
  createdAt: string
}

type InviteRow = {
  id: string
  email: string
  role: string
  token_hash: string
  expires_at: string
  accepted_at: string | null
  accepted_user_id: string | null
  revoked_at: string | null
  created_at: string
}

const DEFAULT_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function createInviteStore(db: AppDatabase) {
  function create(input: InviteInput): { invite: InviteRecord; token: string } {
    const now = new Date()
    const token = randomBytes(32).toString("base64url")
    const invite = {
      id: randomUUID(),
      email: normalizeEmail(input.email),
      role: input.role,
      tokenHash: hashToken(token),
      expiresAt: normalizeDate(input.expiresAt ?? new Date(now.getTime() + DEFAULT_INVITE_TTL_MS)),
      createdAt: now.toISOString(),
    }

    db.run(sql`INSERT INTO _invites (id, email, role, token_hash, expires_at, accepted_at, accepted_user_id, revoked_at, created_at)
      VALUES (${invite.id}, ${invite.email}, ${invite.role}, ${invite.tokenHash}, ${invite.expiresAt}, NULL, NULL, NULL, ${invite.createdAt})`)

    return { invite: get(invite.id)!, token }
  }

  function get(id: string): InviteRecord | null {
    const rows = db.all(sql`SELECT * FROM _invites WHERE id = ${id}`) as InviteRow[]
    return rows[0] ? fromRow(rows[0]) : null
  }

  function listPending(): InviteRecord[] {
    const now = new Date().toISOString()
    const rows = db.all(sql`SELECT * FROM _invites
      WHERE accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ${now}
      ORDER BY created_at DESC, rowid DESC`) as InviteRow[]
    return rows.map(fromRow)
  }

  function acceptByEmail(email: string, userId: string): InviteRecord | null {
    const normalizedEmail = normalizeEmail(email)
    const now = new Date().toISOString()
    const rows = db.all(sql`SELECT * FROM _invites
      WHERE email = ${normalizedEmail}
        AND accepted_at IS NULL
        AND revoked_at IS NULL
        AND expires_at > ${now}
      ORDER BY created_at DESC, rowid DESC
      LIMIT 1`) as InviteRow[]
    const row = rows[0]
    if (!row) return null

    db.run(sql`UPDATE _invites
      SET accepted_at = ${now}, accepted_user_id = ${userId}
      WHERE id = ${row.id}`)
    return get(row.id)
  }

  function revoke(id: string): boolean {
    const now = new Date().toISOString()
    const rows = db.all(sql`SELECT id FROM _invites
      WHERE id = ${id} AND accepted_at IS NULL AND revoked_at IS NULL
      LIMIT 1`) as Array<{ id: string }>
    if (!rows[0]) return false
    db.run(sql`UPDATE _invites SET revoked_at = ${now} WHERE id = ${id}`)
    return true
  }

  return { create, get, listPending, acceptByEmail, revoke }
}

function fromRow(row: InviteRow): InviteRecord {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    acceptedUserId: row.accepted_user_id,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizeDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  return date.toISOString()
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export type InviteStore = ReturnType<typeof createInviteStore>
