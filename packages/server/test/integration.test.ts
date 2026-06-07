import { test, expect, describe, afterAll, beforeAll } from "bun:test"
import { createServer } from "../src/index"
import { createServerConfigFromCMSConfig } from "../src/config"
import { defineCollection, field } from "@not-a-cms/core"
import { sql } from "drizzle-orm"
import { existsSync, rmSync, unlinkSync } from "node:fs"

const testDbPath = "test-integration.db"
const testUploadsPath = "test-integration-uploads"

const blogPost = defineCollection({
  name: "blog_post",
  fields: {
    title: field.text({ required: true }),
    slug: field.slug({ from: "title" }),
    body: field.richText(),
    status: field.select(["draft", "in_review", "published", "archived", "scheduled"], { default: "draft" }),
    publishedAt: field.datetime(),
  },
})

const author = defineCollection({
  name: "author",
  fields: {
    name: field.text({ required: true }),
  },
})

const lockedPreview = defineCollection({
  name: "locked_preview",
  access: {
    read: ["admin"],
    create: ["admin"],
    update: ["admin"],
    delete: ["admin"],
  },
  fields: {
    title: field.text({ required: true }),
    slug: field.slug({ from: "title" }),
    status: field.select(["draft", "published"], { default: "draft" }),
  },
})

let baseUrl: string
let serverInstance: ReturnType<typeof createServer>
let latestMagicLink: string | null = null

describe("integration: full server", () => {
  beforeAll(() => {
    latestMagicLink = null
    serverInstance = createServer({
      port: 0, // random available port
      database: { url: testDbPath },
      auth: {
        secret: "a".repeat(32),
        baseURL: "http://localhost",
        magicLink: {
          sendMagicLink: async ({ url }) => {
            latestMagicLink = url
          },
        },
      },
      collections: [author, blogPost, lockedPreview],
      storage: { provider: "local", path: testUploadsPath },
      cors: { origins: ["http://localhost:4322"] },
    })
    baseUrl = `http://localhost:${serverInstance.server.port}`
  })

  afterAll(() => {
    serverInstance.server.stop()
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
    if (existsSync(testUploadsPath)) rmSync(testUploadsPath, { recursive: true })
  })

  test("health check returns ok", async () => {
    const res = await fetch(`${baseUrl}/health`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("ok")
  })

  test("REST: anonymous writes are rejected; published reads are public but drafts are hidden", async () => {
    const createRes = await fetch(`${baseUrl}/api/blog_post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Integration Test Post",
        slug: "integration-test",
        body: JSON.stringify([{ type: "paragraph", children: [{ type: "text", value: "Hello" }] }]),
        status: "draft",
      }),
    })
    expect(createRes.status).toBe(401)

    const post = await serverInstance.collections.get("blog_post")!.service.create({
      title: "Integration Test Post",
      slug: "integration-test",
      body: JSON.stringify([{ type: "paragraph", children: [{ type: "text", value: "Hello" }] }]),
      status: "published",
    })

    // Published content is publicly readable by ID
    const getRes = await fetch(`${baseUrl}/api/blog_post/${post.id}`)
    expect(getRes.status).toBe(200)
    const found = await getRes.json()
    expect(found.title).toBe("Integration Test Post")

    // ...and in the list
    const listRes = await fetch(`${baseUrl}/api/blog_post`)
    expect(listRes.status).toBe(200)
    const list = await listRes.json()
    expect(list.data.length).toBeGreaterThanOrEqual(1)

    // Drafts must NOT be exposed to anonymous callers
    const draft = await serverInstance.collections.get("blog_post")!.service.create({
      title: "Hidden Draft",
      slug: "hidden-draft",
      body: JSON.stringify([{ type: "paragraph", children: [{ type: "text", value: "secret" }] }]),
      status: "draft",
    })
    const draftRes = await fetch(`${baseUrl}/api/blog_post/${draft.id}`)
    expect(draftRes.status).toBe(404)
    const listAfter = await (await fetch(`${baseUrl}/api/blog_post`)).json()
    expect(listAfter.data.some((d: { id: string }) => d.id === draft.id)).toBe(false)

    const updateRes = await fetch(`${baseUrl}/api/blog_post/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Title" }),
    })
    expect(updateRes.status).toBe(401)

    const deleteRes = await fetch(`${baseUrl}/api/blog_post/${post.id}`, {
      method: "DELETE",
    })
    expect(deleteRes.status).toBe(401)
  })

  test("auth endpoint responds", async () => {
    const res = await fetch(`${baseUrl}/api/auth/ok`)
    expect(res.status).toBe(200)
  })

  test("auth config endpoint exposes enabled login methods", async () => {
    const res = await fetch(`${baseUrl}/api/_auth/config`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      magicLink: true,
      oauthProviders: [],
      passkey: false,
    })
  })

  test("OpenAPI docs endpoint is generated from collection schemas", async () => {
    const res = await fetch(`${baseUrl}/api/_docs/openapi.json`)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.openapi).toBe("3.1.0")
    expect(body.info.title).toBe("not-a-cms API")
    expect(body.paths["/api/blog_post"].get.responses["200"]).toBeDefined()
    expect(body.paths["/api/blog_post"].post.security).toEqual([{ cookieAuth: [] }])
    expect(body.paths["/api/blog_post/{id}"].patch.security).toEqual([{ cookieAuth: [] }])
    expect(body.paths["/api/locked_preview"].get.security).toEqual([{ cookieAuth: [] }])
    expect(body.components.schemas.BlogPost.required).toContain("title")
    expect(body.components.schemas.BlogPost.properties.title).toEqual({ type: "string" })
    expect(body.components.schemas.BlogPost.properties.body).toEqual({ type: "array", items: { type: "object", additionalProperties: true } })
    expect(body.components.schemas.BlogPost.properties.status.enum).toEqual(["draft", "in_review", "published", "archived", "scheduled"])
    expect(body.components.securitySchemes.cookieAuth).toBeDefined()
    expect(body.components.responses.Unauthorized).toBeDefined()
    expect(body.components.responses.Forbidden).toBeDefined()
    expect(body.components.responses.ValidationError).toBeDefined()
  })

  test("server config mapper uses project config collections, database, ports, and storage", () => {
    const mapped = createServerConfigFromCMSConfig(
      {
        site: { url: "http://localhost:7777" },
        database: { provider: "sqlite", url: "mapped.db" },
        storage: { provider: "local", path: "mapped-uploads" },
        collections: [blogPost],
      },
      {
        PORT: "7777",
        BETTER_AUTH_SECRET: "b".repeat(32),
        CORS_ORIGINS: "http://localhost:7778,http://localhost:7779",
      },
    )

    expect(mapped.port).toBe(7777)
    expect(mapped.database.url).toBe("mapped.db")
    expect(mapped.auth.baseURL).toBe("http://localhost:7777")
    expect(mapped.auth.trustedOrigins).toEqual(["http://localhost:7778", "http://localhost:7779"])
    expect(mapped.collections.map((collection) => collection.name)).toEqual(["blog_post"])
    expect(mapped.storage).toEqual({ provider: "local", path: "mapped-uploads" })
    expect(mapped.cors?.origins).toEqual(["http://localhost:7778", "http://localhost:7779"])
  })

  test("channel settings endpoint exposes only public channel keys", async () => {
    serverInstance.settingsService.set("channel.rss.title", "Public Feed")
    serverInstance.settingsService.set("channel.email.preheader", "Inbox preview")
    serverInstance.settingsService.set("theme.primaryColor", "#111111")

    const res = await fetch(`${baseUrl}/api/_channel-settings`)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.data).toEqual({
      "channel.email.preheader": "Inbox preview",
      "channel.rss.title": "Public Feed",
    })
    expect(body.data["theme.primaryColor"]).toBeUndefined()
  })

  test("REST: collection names beginning with auth are not routed to auth", async () => {
    const res = await fetch(`${baseUrl}/api/author`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  test("REST: public route queries can fetch published documents by slug", async () => {
    await serverInstance.collections.get("blog_post")!.service.create({
      title: "Route Draft",
      slug: "route-resolution",
      status: "draft",
    })
    const published = await serverInstance.collections.get("blog_post")!.service.create({
      title: "Route Published",
      slug: "route-resolution",
      status: "published",
    })

    const params = new URLSearchParams({
      limit: "1",
      "where[slug]": "route-resolution",
      "where[status]": "published",
    })
    const res = await fetch(`${baseUrl}/api/blog_post?${params}`)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe(published.id)
    expect(body.data[0].status).toBe("published")
  })

  test("scheduler endpoint is protected and server scheduler can publish due content", async () => {
    const due = "2026-05-31T05:00:00.000Z"
    const post = await serverInstance.collections.get("blog_post")!.service.create({
      title: "Scheduled Integration Post",
      slug: "scheduled-integration-post",
      status: "draft",
      publishedAt: due,
    })

    const unauthorized = await fetch(`${baseUrl}/api/_scheduler/run`, { method: "POST" })
    expect(unauthorized.status).toBe(401)

    const promoted = await serverInstance.scheduler.promoteScheduled(new Date(due))
    expect(promoted.map((doc) => doc.id)).toContain(post.id)

    const updated = await serverInstance.collections.get("blog_post")!.service.findById(String(post.id))
    expect(updated?.status).toBe("published")
  })

  test("preview validation serves valid tokens for collections anonymous REST cannot read", async () => {
    const locked = await serverInstance.collections.get("locked_preview")!.service.create({
      title: "Private Draft Preview",
      slug: "private-draft-preview",
      status: "draft",
    })

    const restRes = await fetch(`${baseUrl}/api/locked_preview/${locked.id}`)
    expect(restRes.status).toBe(403)

    const token = serverInstance.previewTokenService.generate("locked_preview", String(locked.id), { regenerate: true })
    const previewRes = await fetch(`${baseUrl}/api/_preview/validate/${token.token}?collection=locked_preview&documentId=${locked.id}`)
    expect(previewRes.status).toBe(200)
    const preview = await previewRes.json()
    expect(preview.title).toBe("Private Draft Preview")
    expect(preview._preview).toBe(true)
    expect(preview._collection).toBe("locked_preview")

    const mismatchRes = await fetch(`${baseUrl}/api/_preview/validate/${token.token}?collection=blog_post&documentId=${locked.id}`)
    expect(mismatchRes.status).toBe(403)
  })

  test("automation runs are created from content events and failed runs can be retried", async () => {
    const cookie = await signInAndGetCookie("settings-admin@example.test")
    const flow = serverInstance.flowStore.createFlow({
      name: "Content create audit",
      trigger: { type: "content.created", collection: "blog_post" },
      steps: [
        { id: "log-created", type: "action.log", config: { message: "Created {{document.title}}" }, next: null },
      ],
      active: true,
    })

    await serverInstance.collections.get("blog_post")!.service.create({
      title: "Automation Event Post",
      slug: "automation-event-post",
      status: "draft",
    })

    const runs = await waitForFlowRuns(flow.id, 1)
    expect(runs[0].trigger_event).toBe("content.created")
    expect(JSON.parse(runs[0].trigger_payload).document.title).toBe("Automation Event Post")

    const detailRes = await fetch(`${baseUrl}/api/_flows/${flow.id}/runs/${runs[0].id}`, { headers: { cookie } })
    expect(detailRes.status).toBe(200)
    const detail = await detailRes.json()
    expect(detail.steps[0].step_id).toBe("log-created")
    expect(JSON.parse(detail.steps[0].output).message).toBe("Created Automation Event Post")

    const failed = serverInstance.flowStore.createRun(flow.id, "content.created", JSON.stringify({
      event: "content.created",
      collection: "blog_post",
      document: { title: "Retry Event Post" },
    }))
    serverInstance.flowStore.completeRun(failed.id, "failed", "Temporary failure")

    const retryRes = await fetch(`${baseUrl}/api/_flows/${flow.id}/runs/${failed.id}/retry`, {
      method: "POST",
      headers: { cookie },
    })
    expect(retryRes.status).toBe(200)
    const retry = await retryRes.json()
    expect(retry.runId).toBeTruthy()
    expect(retry.runId).not.toBe(failed.id)
    expect(serverInstance.flowStore.getRun(retry.runId)?.status).toBe("completed")
  })

  test("dashboard metrics endpoint summarizes content, media, and recent audit", async () => {
    const draft = await serverInstance.collections.get("blog_post")!.service.create({
      title: "Metrics Draft",
      slug: "metrics-draft",
      status: "draft",
    })
    await serverInstance.collections.get("blog_post")!.service.create({
      title: "Metrics Review",
      slug: "metrics-review",
      status: "in_review",
    })
    await serverInstance.collections.get("blog_post")!.service.create({
      title: "Metrics Published",
      slug: "metrics-published",
      status: "published",
    })
    await serverInstance.collections.get("blog_post")!.service.create({
      title: "Metrics Scheduled",
      slug: "metrics-scheduled",
      status: "scheduled",
      publishedAt: "2030-01-01T00:00:00.000Z",
    })
    serverInstance.auditLogStore.record({
      action: "content.created",
      collection: "blog_post",
      documentId: String(draft.id),
      summary: "Created metrics draft",
    })

    const anonymous = await fetch(`${baseUrl}/api/_metrics`)
    expect(anonymous.status).toBe(401)

    const cookie = await signInAndGetCookie("settings-admin@example.test")
    const res = await fetch(`${baseUrl}/api/_metrics`, { headers: { cookie } })
    expect(res.status).toBe(200)
    const body = await res.json()
    const blog = body.collections.find((entry: any) => entry.name === "blog_post")

    expect(blog.label).toBe("Blog Posts")
    expect(blog.total).toBeGreaterThanOrEqual(4)
    expect(blog.drafts).toBeGreaterThanOrEqual(1)
    expect(blog.inReview).toBeGreaterThanOrEqual(1)
    expect(blog.published).toBeGreaterThanOrEqual(1)
    expect(blog.scheduled).toBeGreaterThanOrEqual(1)
    expect(body.media.total).toBe(0)
    expect(body.recentAudit[0].summary).toBe("Created metrics draft")
  })

  test("collection settings endpoints persist collection metadata while keeping code fields", async () => {
    const anonymous = await fetch(`${baseUrl}/api/_collection-settings`)
    expect(anonymous.status).toBe(401)

    const cookie = await signInAndGetCookie("settings-admin@example.test")
    const listRes = await fetch(`${baseUrl}/api/_collection-settings`, {
      headers: { cookie },
    })
    expect(listRes.status).toBe(200)
    const list = await listRes.json()
    const listedBlog = list.data.find((entry: any) => entry.name === "blog_post")
    expect(listedBlog.fields.title.type).toBe("text")

    const saveRes = await fetch(`${baseUrl}/api/_collection-settings/blog_post`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        labels: { singular: "Article", plural: "Articles" },
        access: { read: ["admin"], create: ["editor"], update: ["editor"], delete: ["admin"] },
        previewPath: "articles/:slug",
        searchFields: ["title", "missing"],
        editorLayout: "sidebar",
        fields: { injected: { type: "text" } },
      }),
    })
    expect(saveRes.status).toBe(200)
    const saved = await saveRes.json()
    expect(saved.labels.singular).toBe("Article")
    expect(saved.fields.title.type).toBe("text")
    expect(saved.fields.injected).toBeUndefined()
    expect(saved.settings.previewPath).toBe("/articles/:slug")
    expect(saved.settings.searchFields).toEqual(["title"])
    expect(saved.settings.access.read).toEqual(["admin"])

    const forbiddenList = await fetch(`${baseUrl}/api/blog_post`)
    expect(forbiddenList.status).toBe(403)

    const invalidRoleRes = await fetch(`${baseUrl}/api/_collection-settings/blog_post`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ access: { read: ["not-a-role"] } }),
    })
    expect(invalidRoleRes.status).toBe(400)
  })

  test("team invite endpoints assign invited roles after sign-in", async () => {
    const adminCookie = await signInAndGetCookie("settings-admin@example.test")

    const anonymous = await fetch(`${baseUrl}/api/_invites`)
    expect(anonymous.status).toBe(401)

    const createRes = await fetch(`${baseUrl}/api/_invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ email: "Invited.Editor@Example.test", role: "editor" }),
    })
    expect(createRes.status).toBe(200)
    const created = await createRes.json()
    expect(created.token).toBeTruthy()
    expect(created.invite.email).toBe("invited.editor@example.test")
    expect(created.invite.tokenHash).toBeUndefined()

    const listRes = await fetch(`${baseUrl}/api/_invites`, { headers: { cookie: adminCookie } })
    expect(listRes.status).toBe(200)
    const listed = await listRes.json()
    expect(listed.data.some((invite: any) => invite.email === "invited.editor@example.test")).toBe(true)
    expect(listed.data[0].tokenHash).toBeUndefined()

    const invitedCookie = await signInAndGetCookie("invited.editor@example.test")
    const invitedRoles = await fetch(`${baseUrl}/api/_roles`, { headers: { cookie: invitedCookie } })
    expect(invitedRoles.status).toBe(200)

    const usersRes = await fetch(`${baseUrl}/api/_users`, { headers: { cookie: adminCookie } })
    expect(usersRes.status).toBe(200)
    const users = await usersRes.json()
    const invitedUser = users.data.find((user: any) => user.email === "invited.editor@example.test")
    expect(invitedUser?.role).toBe("editor")

    const revokeCreateRes = await fetch(`${baseUrl}/api/_invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ email: "revoked@example.test", role: "viewer" }),
    })
    const revokeCreated = await revokeCreateRes.json()
    const revokeRes = await fetch(`${baseUrl}/api/_invites/${revokeCreated.invite.id}`, {
      method: "DELETE",
      headers: { cookie: adminCookie },
    })
    expect(revokeRes.status).toBe(200)
    expect(await revokeRes.json()).toEqual({ revoked: true })
  })

  test("management endpoints enforce admin or editor role gates", async () => {
    const adminCookie = await signInAndGetCookie("settings-admin@example.test")
    const viewerCookie = await signInAndGetCookie("security-viewer@example.test")
    const viewerRows = serverInstance.db.all(sql`SELECT id, email FROM user WHERE email = ${"security-viewer@example.test"}`) as Array<{ id: string; email: string }>
    serverInstance.userRoleStore.upsert({ userId: viewerRows[0].id, email: viewerRows[0].email, role: "viewer", active: true })

    serverInstance.auditLogStore.record({
      action: "security.audit",
      summary: "security gate test",
    })

    const viewerAudit = await fetch(`${baseUrl}/api/_audit`, { headers: { cookie: viewerCookie } })
    expect(viewerAudit.status).toBe(403)
    const adminAudit = await fetch(`${baseUrl}/api/_audit`, { headers: { cookie: adminCookie } })
    expect(adminAudit.status).toBe(200)

    const viewerSettings = await fetch(`${baseUrl}/api/_settings`, { headers: { cookie: viewerCookie } })
    expect(viewerSettings.status).toBe(403)

    const viewerWebhooks = await fetch(`${baseUrl}/api/_webhooks`, { headers: { cookie: viewerCookie } })
    expect(viewerWebhooks.status).toBe(403)

    const viewerFlows = await fetch(`${baseUrl}/api/_flows`, { headers: { cookie: viewerCookie } })
    expect(viewerFlows.status).toBe(403)

    const formData = new FormData()
    formData.append("file", new Blob(["viewer upload"], { type: "text/plain" }), "viewer.txt")
    const viewerUpload = await fetch(`${baseUrl}/api/media/upload`, {
      method: "POST",
      headers: { cookie: viewerCookie },
      body: formData,
    })
    expect(viewerUpload.status).toBe(403)

    const invalidWebhook = await fetch(`${baseUrl}/api/_webhooks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ url: "not-a-url", events: "content.created" }),
    })
    expect(invalidWebhook.status).toBe(400)

    const viewerRowsAfterSignIn = serverInstance.db.all(sql`SELECT id FROM user WHERE email = ${"security-viewer@example.test"}`) as Array<{ id: string }>
    const invalidRole = await fetch(`${baseUrl}/api/_users/${viewerRowsAfterSignIn[0].id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ role: "not-a-role", active: true }),
    })
    expect(invalidRole.status).toBe(400)
  })

  test("adds credentialed CORS headers for allowed admin origins", async () => {
    const preflight = await fetch(`${baseUrl}/api/_schema`, {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:4322",
        "access-control-request-method": "GET",
      },
    })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get("access-control-allow-origin")).toBe("http://localhost:4322")
    expect(preflight.headers.get("access-control-allow-credentials")).toBe("true")

    const res = await fetch(`${baseUrl}/api/_schema`, {
      headers: { origin: "http://localhost:4322" },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:4322")
    expect(res.headers.get("access-control-allow-credentials")).toBe("true")
  })

  test("unknown route returns 404", async () => {
    const res = await fetch(`${baseUrl}/nothing`)
    expect(res.status).toBe(404)
  })

  test("GET /api/_site returns nulls when no site is configured", async () => {
    const res = await fetch(`${baseUrl}/api/_site`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.siteName).toBeNull()
    expect(body.nav).toBeNull()
    expect(body.footer).toBeNull()
    expect(body.theme).toEqual({ name: null, version: null, settings: null })
  })

  test("POST /api/_site returns 405 Method Not Allowed", async () => {
    const res = await fetch(`${baseUrl}/api/_site`, { method: "POST" })
    expect(res.status).toBe(405)
  })
})

async function signInAndGetCookie(email: string): Promise<string> {
  latestMagicLink = null
  const signIn = await fetch(`${baseUrl}/api/auth/sign-in/magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: baseUrl },
    body: JSON.stringify({ email }),
  })
  expect(signIn.status).toBe(200)
  expect(latestMagicLink).toBeTruthy()
  const verifyUrl = new URL(latestMagicLink!)
  const verify = await fetch(`${baseUrl}${verifyUrl.pathname}${verifyUrl.search}`, {
    redirect: "manual",
    headers: { origin: baseUrl },
  })
  const cookie = verify.headers.get("set-cookie")
  expect(cookie).toBeTruthy()
  return cookie!
}

async function waitForFlowRuns(flowId: string, count: number) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const runs = serverInstance.flowStore.listRuns(flowId)
    if (runs.length >= count) return runs
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  return serverInstance.flowStore.listRuns(flowId)
}
