import { afterEach, describe, expect, test } from "bun:test"
import {
  createInvite,
  listAuditEvents,
  listInvites,
  listRoles,
  listTeamMembers,
  type RoleDefinition,
  revokeInvite,
  saveRoles,
  updateTeamMemberRole,
} from "../../src/lib/access"
import { AdminApiError, isForbiddenError } from "../../src/lib/api"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("admin access API client", () => {
  test("loads role definitions with credentials", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return Response.json({ data: [{ key: "admin", label: "Admin" }] })
    }) as typeof fetch

    const roles = await listRoles("https://cms.example.test/base/")

    expect(calls[0]?.url).toBe("https://cms.example.test/base/api/_roles")
    expect(calls[0]?.init?.credentials).toBe("include")
    expect(roles[0]?.key).toBe("admin")
  })

  test("saves role definitions", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return Response.json({ ok: true })
    }) as typeof fetch

    const roles: RoleDefinition[] = [{ key: "legal", label: "Legal" }]
    await saveRoles("https://cms.example.test", roles)

    expect(calls[0]?.url).toBe("https://cms.example.test/api/_roles")
    expect(calls[0]?.init?.method).toBe("PUT")
    expect(calls[0]?.init?.credentials).toBe("include")
    expect(JSON.parse(String(calls[0]?.init?.body)).roles).toEqual(roles)
  })

  test("loads audit events", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return Response.json({ data: [{ id: "audit-1", action: "content.updated" }] })
    }) as typeof fetch

    const events = await listAuditEvents("https://cms.example.test", { collection: "page" })

    expect(calls[0]?.url).toBe("https://cms.example.test/api/_audit?collection=page")
    expect(calls[0]?.init?.credentials).toBe("include")
    expect(events[0]?.id).toBe("audit-1")
  })

  test("loads team members", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return Response.json({
        data: [{ userId: "user-1", email: "editor@example.test", role: "editor" }],
      })
    }) as typeof fetch

    const members = await listTeamMembers("https://cms.example.test")

    expect(calls[0]?.url).toBe("https://cms.example.test/api/_users")
    expect(calls[0]?.init?.credentials).toBe("include")
    expect(members[0]?.role).toBe("editor")
  })

  test("updates a team member role", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return Response.json({ userId: "user-1", role: "admin", active: true })
    }) as typeof fetch

    await updateTeamMemberRole("https://cms.example.test", "user-1", {
      role: "admin",
      active: true,
    })

    expect(calls[0]?.url).toBe("https://cms.example.test/api/_users/user-1")
    expect(calls[0]?.init?.method).toBe("PATCH")
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ role: "admin", active: true })
  })

  test("manages pending invites", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      if (init?.method === "POST")
        return Response.json({
          invite: { id: "invite-1", email: "new@example.test", role: "editor" },
          token: "raw-token",
        })
      if (init?.method === "DELETE") return Response.json({ revoked: true })
      return Response.json({
        data: [{ id: "invite-1", email: "new@example.test", role: "editor" }],
      })
    }) as typeof fetch

    const invites = await listInvites("https://cms.example.test")
    const created = await createInvite("https://cms.example.test", {
      email: "new@example.test",
      role: "editor",
    })
    await revokeInvite("https://cms.example.test", "invite-1")

    expect(invites[0]?.id).toBe("invite-1")
    expect(created.token).toBe("raw-token")
    expect(calls[0]?.url).toBe("https://cms.example.test/api/_invites")
    expect(calls[1]?.init?.method).toBe("POST")
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({
      email: "new@example.test",
      role: "editor",
    })
    expect(calls[2]?.url).toBe("https://cms.example.test/api/_invites/invite-1")
    expect(calls[2]?.init?.method).toBe("DELETE")
  })

  test("rejects with a forbidden AdminApiError when a loader returns 403", async () => {
    globalThis.fetch = (async (_url: string | URL | Request, _init?: RequestInit) =>
      Response.json({ error: "Forbidden" }, { status: 403 })) as typeof fetch

    const error = await listRoles("https://cms.example.test").then(
      () => null,
      (err) => err,
    )

    expect(error).toBeInstanceOf(AdminApiError)
    expect((error as AdminApiError).status).toBe(403)
    expect(isForbiddenError(error)).toBe(true)
  })

  test("preserves non-403 status on loader failures so they are not treated as forbidden", async () => {
    globalThis.fetch = (async (_url: string | URL | Request, _init?: RequestInit) =>
      Response.json({ error: "Server error" }, { status: 500 })) as typeof fetch

    const error = await listTeamMembers("https://cms.example.test").then(
      () => null,
      (err) => err,
    )

    expect(error).toBeInstanceOf(AdminApiError)
    expect((error as AdminApiError).status).toBe(500)
    expect(isForbiddenError(error)).toBe(false)
  })
})
