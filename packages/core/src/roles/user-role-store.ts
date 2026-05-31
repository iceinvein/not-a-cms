import { sql } from "drizzle-orm"
import type { AppDatabase } from "../db/connection"

export type UserRoleInput = {
  userId: string
  email?: string | null
  role: string
  active?: boolean
}

export type UserRoleRecord = {
  userId: string
  email: string | null
  role: string
  active: boolean
  createdAt: string
  updatedAt: string
}

type UserRoleRow = {
  user_id: string
  email: string | null
  role: string
  active: number
  created_at: string
  updated_at: string
}

export function createUserRoleStore(db: AppDatabase) {
  function get(userId: string): UserRoleRecord | null {
    const rows = db.all(sql`SELECT * FROM _user_roles WHERE user_id = ${userId}`) as UserRoleRow[]
    return rows[0] ? fromRow(rows[0]) : null
  }

  function list(): UserRoleRecord[] {
    const rows = db.all(sql`SELECT * FROM _user_roles ORDER BY updated_at DESC, rowid DESC`) as UserRoleRow[]
    return rows.map(fromRow)
  }

  function hasActiveAdmin(): boolean {
    const rows = db.all(sql`SELECT user_id FROM _user_roles WHERE role = ${"admin"} AND active = 1 LIMIT 1`) as Array<{ user_id: string }>
    return rows.length > 0
  }

  function upsert(input: UserRoleInput): UserRoleRecord {
    const now = new Date().toISOString()
    const existing = get(input.userId)
    const active = input.active ?? existing?.active ?? true
    const createdAt = existing?.createdAt ?? now

    db.run(sql`INSERT INTO _user_roles (user_id, email, role, active, created_at, updated_at)
      VALUES (${input.userId}, ${input.email ?? existing?.email ?? null}, ${input.role}, ${active ? 1 : 0}, ${createdAt}, ${now})
      ON CONFLICT(user_id) DO UPDATE SET
        email = excluded.email,
        role = excluded.role,
        active = excluded.active,
        updated_at = excluded.updated_at`)

    return get(input.userId)!
  }

  return { get, list, hasActiveAdmin, upsert }
}

function fromRow(row: UserRoleRow): UserRoleRecord {
  return {
    userId: row.user_id,
    email: row.email,
    role: row.role,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export type UserRoleStore = ReturnType<typeof createUserRoleStore>
