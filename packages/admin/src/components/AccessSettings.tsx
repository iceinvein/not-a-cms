import {
  Check,
  Copy,
  History,
  Plus,
  Save,
  Send,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react"
import { useEffect, useState } from "react"
import {
  type AuditEvent,
  createInvite,
  listAuditEvents,
  listInvites,
  listRoles,
  listTeamMembers,
  type PendingInvite,
  type RoleDefinition,
  revokeInvite,
  saveRoles,
  type TeamMember,
  updateTeamMemberRole,
} from "../lib/access"
import { isForbiddenError } from "../lib/api"
import { EmptyState, ErrorState, ForbiddenState, LoadingState } from "./AdminState"

type Props = {
  apiBase?: string
}

const EMPTY_ROLE: RoleDefinition = { key: "", label: "", description: "" }

export function AccessSettings({ apiBase = "" }: Props) {
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [forbidden, setForbidden] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("")
  const [inviteToken, setInviteToken] = useState("")
  const [inviting, setInviting] = useState(false)
  const [revokingInvite, setRevokingInvite] = useState<string | null>(null)
  const [tokenCopied, setTokenCopied] = useState(false)

  const copyToken = async () => {
    try {
      await navigator.clipboard?.writeText(inviteToken)
      setTokenCopied(true)
      setTimeout(() => setTokenCopied(false), 2000)
    } catch {
      setError("Couldn't copy the token. Select and copy it manually.")
    }
  }

  useEffect(() => {
    let cancelled = false

    Promise.all([
      listRoles(apiBase),
      listInvites(apiBase),
      listTeamMembers(apiBase),
      listAuditEvents(apiBase, { limit: 8 }),
    ])
      .then(([nextRoles, nextInvites, nextTeamMembers, nextEvents]) => {
        if (cancelled) return
        setRoles(nextRoles)
        setInvites(nextInvites)
        setTeamMembers(nextTeamMembers)
        setAuditEvents(nextEvents)
        setInviteRole((current) => current || nextRoles[0]?.key || "")
      })
      .catch((err) => {
        if (cancelled) return
        if (isForbiddenError(err)) setForbidden(true)
        else setError("Could not load access settings.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [apiBase])

  const updateRole = (index: number, patch: Partial<RoleDefinition>) => {
    setRoles((current) =>
      current.map((role, roleIndex) => (roleIndex === index ? { ...role, ...patch } : role)),
    )
    setSaved(false)
  }

  const addRole = () => {
    setRoles((current) => [...current, { ...EMPTY_ROLE }])
    setSaved(false)
  }

  const removeRole = (index: number) => {
    setRoles((current) => current.filter((role, roleIndex) => roleIndex !== index || role.system))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError("")
    try {
      const savedRoles = await saveRoles(apiBase, roles)
      setRoles(savedRoles)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError("Could not save roles. Role keys must be lowercase and unique.")
    } finally {
      setSaving(false)
    }
  }

  const changeMemberRole = async (member: TeamMember, role: string) => {
    setError("")
    const previous = teamMembers
    setTeamMembers((current) =>
      current.map((entry) => (entry.userId === member.userId ? { ...entry, role } : entry)),
    )
    try {
      const updated = await updateTeamMemberRole(apiBase, member.userId, {
        email: member.email,
        role,
        active: member.active,
      })
      setTeamMembers((current) =>
        current.map((entry) => (entry.userId === updated.userId ? updated : entry)),
      )
    } catch {
      setTeamMembers(previous)
      setError("Could not update team member role.")
    }
  }

  const handleInvite = async (event: { preventDefault: () => void }) => {
    event.preventDefault()
    setError("")
    setInviteToken("")
    setInviting(true)
    try {
      const created = await createInvite(apiBase, {
        email: inviteEmail,
        role: inviteRole || roles[0]?.key || "",
      })
      setInvites((current) => [
        created.invite,
        ...current.filter((invite) => invite.id !== created.invite.id),
      ])
      setInviteEmail("")
      setInviteRole(created.invite.role)
      setInviteToken(created.token)
    } catch {
      setError("Could not create invite. Check the email address and selected role.")
    } finally {
      setInviting(false)
    }
  }

  const revokePendingInvite = async (invite: PendingInvite) => {
    setError("")
    setRevokingInvite(invite.id)
    const previous = invites
    setInvites((current) => current.filter((entry) => entry.id !== invite.id))
    try {
      const revoked = await revokeInvite(apiBase, invite.id)
      if (!revoked) setInvites(previous)
    } catch {
      setInvites(previous)
      setError("Could not revoke invite.")
    } finally {
      setRevokingInvite(null)
    }
  }

  if (forbidden) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-base font-semibold text-[#fafafa]">Access Control</h2>
          <p className="text-sm text-[#909099]">
            Manage role labels used by schema field permissions.
          </p>
        </div>
        <ForbiddenState description="Access control is limited to administrators." />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#fafafa]">Access Control</h2>
          <p className="text-sm text-[#909099]">
            Manage role labels used by schema field permissions.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#c6ff3d] text-[#0a0a0c] rounded-lg text-sm font-medium hover:bg-[#d4ff6e] disabled:opacity-50 transition-colors"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : saved ? "Saved" : "Save Roles"}
        </button>
      </div>

      {error && <ErrorState compact title="Access settings unavailable" description={error} />}

      <section className="bg-[#18181b] rounded-lg border border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-medium text-[#fafafa]">
            <Shield className="h-4 w-4 text-[#909099]" />
            Roles
          </div>
          <button
            type="button"
            onClick={addRole}
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-[rgba(255,255,255,0.1)] rounded-lg text-xs font-medium text-[#fafafa] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Role
          </button>
        </div>

        <div className="divide-y divide-[rgba(255,255,255,0.06)]">
          {loading ? (
            <div className="p-5">
              <LoadingState
                compact
                title="Loading roles"
                description="Fetching role definitions."
              />
            </div>
          ) : (
            roles.map((role, index) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: roles have no stable id and role.key may be empty/duplicate while editing, so the index disambiguates new rows
                key={`${role.key}-${index}`}
                className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(120px,180px)_minmax(140px,1fr)_minmax(180px,1.4fr)_auto] md:items-center"
              >
                <input
                  value={role.key}
                  disabled={role.system}
                  onChange={(event) => updateRole(index, { key: event.target.value })}
                  placeholder="role_key"
                  className="px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-transparent text-[#fafafa] placeholder:text-[#838389] disabled:text-[#909099] focus:border-[#c6ff3d] focus:outline-none"
                />
                <input
                  value={role.label}
                  onChange={(event) => updateRole(index, { label: event.target.value })}
                  placeholder="Label"
                  className="px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-transparent text-[#fafafa] placeholder:text-[#838389] focus:border-[#c6ff3d] focus:outline-none"
                />
                <input
                  value={role.description ?? ""}
                  onChange={(event) => updateRole(index, { description: event.target.value })}
                  placeholder="Description"
                  className="px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-transparent text-[#fafafa] placeholder:text-[#838389] focus:border-[#c6ff3d] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeRole(index)}
                  disabled={role.system}
                  aria-label={`Remove ${role.label || role.key}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.1)] text-[#ef4444] hover:text-[#f87171] hover:border-[rgba(239,68,68,0.3)] disabled:text-[#838389] disabled:opacity-40 disabled:hover:text-[#838389] disabled:hover:border-[rgba(255,255,255,0.1)]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="bg-[#18181b] rounded-lg border border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.06)] px-5 py-4 text-sm font-medium text-[#fafafa]">
          <UserPlus className="h-4 w-4 text-[#909099]" />
          Invites
        </div>
        <div className="space-y-4 p-5">
          <form
            onSubmit={handleInvite}
            className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_minmax(140px,220px)_auto] md:items-end"
          >
            <label className="grid gap-1.5 text-xs font-medium uppercase tracking-[0.08em] text-[#909099]">
              Email
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="editor@example.com"
                className="px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm normal-case tracking-normal bg-transparent text-[#fafafa] placeholder:text-[#838389] focus:border-[#c6ff3d] focus:outline-none"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium uppercase tracking-[0.08em] text-[#909099]">
              Role
              <select
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value)}
                disabled={roles.length === 0}
                className="px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm normal-case tracking-normal bg-[#18181b] text-[#fafafa] disabled:opacity-50 focus:border-[#c6ff3d] focus:outline-none"
              >
                {roles.map((role) => (
                  <option key={role.key} value={role.key}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={loading || inviting || !inviteEmail || roles.length === 0}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#c6ff3d] text-[#0a0a0c] rounded-lg text-sm font-medium hover:bg-[#d4ff6e] disabled:opacity-50 transition-colors"
            >
              <Send className="h-4 w-4" />
              {inviting ? "Sending..." : "Send Invite"}
            </button>
          </form>

          {inviteToken && (
            <div className="flex flex-col gap-2 rounded-lg border border-[#365f3f] bg-[#132016] px-4 py-3 text-sm text-[#b7d7bd] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-[#d7f5dc]">One-time invite token</p>
                <code className="mt-1 block break-all text-xs text-[#b7d7bd]">{inviteToken}</code>
              </div>
              <button
                type="button"
                onClick={copyToken}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#365f3f] px-3 py-2 text-xs font-medium text-[#d7f5dc] hover:bg-[rgba(255,255,255,0.04)]"
              >
                {tokenCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {tokenCopied ? "Copied!" : "Copy"}
              </button>
            </div>
          )}

          <div className="divide-y divide-[rgba(255,255,255,0.06)] rounded-lg border border-[rgba(255,255,255,0.06)]">
            {loading ? (
              <div className="p-4">
                <LoadingState
                  compact
                  title="Loading invites"
                  description="Fetching pending team invites."
                />
              </div>
            ) : invites.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  compact
                  title="No pending invites"
                  description="New team invites will appear here until accepted or revoked."
                />
              </div>
            ) : (
              invites.map((invite) => (
                <div
                  key={invite.id}
                  className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_minmax(120px,180px)_minmax(140px,180px)_auto] md:items-center"
                >
                  <div>
                    <p className="text-sm font-medium text-[#fafafa]">{invite.email}</p>
                    <p className="text-xs text-[#909099]">Created {formatDate(invite.createdAt)}</p>
                  </div>
                  <p className="text-sm text-[#d4d4d8]">{roleLabel(roles, invite.role)}</p>
                  <time className="text-xs text-[#909099]">
                    Expires {formatDate(invite.expiresAt)}
                  </time>
                  <button
                    type="button"
                    onClick={() => revokePendingInvite(invite)}
                    disabled={revokingInvite === invite.id}
                    aria-label={`Revoke invite for ${invite.email}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.1)] text-[#a1a1aa] hover:text-[#ef4444] disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="bg-[#18181b] rounded-lg border border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.06)] px-5 py-4 text-sm font-medium text-[#fafafa]">
          <Users className="h-4 w-4 text-[#909099]" />
          Team Members
        </div>
        <div className="divide-y divide-[rgba(255,255,255,0.06)]">
          {loading ? (
            <div className="p-5">
              <LoadingState
                compact
                title="Loading team members"
                description="Fetching assigned user roles."
              />
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="p-5">
              <EmptyState
                compact
                title="No assigned team members yet"
                description="Users will appear here after they sign in or are invited."
              />
            </div>
          ) : (
            teamMembers.map((member) => (
              <div
                key={member.userId}
                className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_minmax(140px,220px)] md:items-center"
              >
                <div>
                  <p className="text-sm font-medium text-[#fafafa]">
                    {member.email || member.userId}
                  </p>
                  <p className="text-xs text-[#909099]">
                    {member.active ? "Active" : "Inactive"} / {member.userId}
                  </p>
                </div>
                <select
                  value={member.role}
                  onChange={(event) => changeMemberRole(member, event.target.value)}
                  className="w-full px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-[#18181b] text-[#fafafa] focus:border-[#c6ff3d] focus:outline-none"
                >
                  {roles.map((role) => (
                    <option key={role.key} value={role.key}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="bg-[#18181b] rounded-lg border border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.06)] px-5 py-4 text-sm font-medium text-[#fafafa]">
          <History className="h-4 w-4 text-[#909099]" />
          Audit Trail
        </div>
        <div className="divide-y divide-[rgba(255,255,255,0.06)]">
          {loading ? (
            <div className="p-5">
              <LoadingState
                compact
                title="Loading audit trail"
                description="Fetching recent changes."
              />
            </div>
          ) : auditEvents.length === 0 ? (
            <div className="p-5">
              <EmptyState
                compact
                title="No audit events yet"
                description="Content and access changes will be listed here."
              />
            </div>
          ) : (
            auditEvents.map((event) => (
              <div
                key={event.id}
                className="grid gap-1 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <p className="text-sm font-medium text-[#fafafa]">
                    {event.summary || event.action}
                  </p>
                  <p className="text-xs text-[#909099]">
                    {[event.collection, event.documentId, event.actorRole]
                      .filter(Boolean)
                      .join(" / ")}
                  </p>
                </div>
                <time className="text-xs text-[#909099]">{formatDate(event.createdAt)}</time>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function roleLabel(roles: RoleDefinition[], key: string): string {
  return roles.find((role) => role.key === key)?.label ?? key
}
