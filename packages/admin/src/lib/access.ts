import { adminApiFetch, joinAdminApiUrl } from "./api"

export type RoleDefinition = {
  key: string
  label: string
  description?: string
  system?: boolean
}

export type AuditEvent = {
  id: string
  action: string
  actorId: string | null
  actorRole: string | null
  collection: string | null
  documentId: string | null
  summary: string | null
  createdAt: string
}

export type TeamMember = {
  userId: string
  email: string | null
  role: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export type PendingInvite = {
  id: string
  email: string
  role: string
  expiresAt: string
  acceptedAt: string | null
  acceptedUserId: string | null
  revokedAt: string | null
  createdAt: string
}

export type InviteInput = {
  email: string
  role: string
}

export type CreatedInvite = {
  invite: PendingInvite
  token: string
}

export type AuditQuery = {
  collection?: string
  documentId?: string
  limit?: number
  offset?: number
}

export async function listRoles(apiBase: string): Promise<RoleDefinition[]> {
  const res = await adminApiFetch(apiBase, "/api/_roles")
  if (!res.ok) throw new Error("Failed to load roles")
  const body = await res.json()
  return body.data ?? []
}

export async function saveRoles(apiBase: string, roles: RoleDefinition[]): Promise<RoleDefinition[]> {
  const res = await adminApiFetch(apiBase, "/api/_roles", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roles }),
  })
  if (!res.ok) throw new Error("Failed to save roles")
  const body = await res.json()
  return body.data ?? roles
}

export async function listAuditEvents(apiBase: string, query: AuditQuery = {}): Promise<AuditEvent[]> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value))
  }
  const path = `/api/_audit${params.size > 0 ? `?${params.toString()}` : ""}`
  const res = await fetch(joinAdminApiUrl(apiBase, path), { credentials: "include" })
  if (!res.ok) throw new Error("Failed to load audit events")
  const body = await res.json()
  return body.data ?? []
}

export async function listTeamMembers(apiBase: string): Promise<TeamMember[]> {
  const res = await adminApiFetch(apiBase, "/api/_users")
  if (!res.ok) throw new Error("Failed to load team members")
  const body = await res.json()
  return body.data ?? []
}

export async function updateTeamMemberRole(
  apiBase: string,
  userId: string,
  input: { role: string; active?: boolean; email?: string | null },
): Promise<TeamMember> {
  const res = await adminApiFetch(apiBase, `/api/_users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error("Failed to update team member")
  return res.json()
}

export async function listInvites(apiBase: string): Promise<PendingInvite[]> {
  const res = await adminApiFetch(apiBase, "/api/_invites")
  if (!res.ok) throw new Error("Failed to load invites")
  const body = await res.json()
  return body.data ?? []
}

export async function createInvite(apiBase: string, input: InviteInput): Promise<CreatedInvite> {
  const res = await adminApiFetch(apiBase, "/api/_invites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error("Failed to create invite")
  return res.json()
}

export async function revokeInvite(apiBase: string, inviteId: string): Promise<boolean> {
  const res = await adminApiFetch(apiBase, `/api/_invites/${encodeURIComponent(inviteId)}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to revoke invite")
  const body = await res.json()
  return Boolean(body.revoked)
}
