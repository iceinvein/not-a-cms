import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { createRestHandler } from "../../src/rest/handler"
import {
  createDatabase,
  bootstrapTables,
  generateTable,
  defineCollection,
  field,
  createContentService,
  createVersioningService,
  createWebhookStore,
  createWebhookService,
} from "@not-a-cms/core"
import { sql } from "drizzle-orm"
import { unlinkSync } from "node:fs"

const testDbPath = "test-rest.db"

const page = defineCollection({
  name: "page",
  fields: {
    title: field.text({ required: true }),
    slug: field.slug({ from: "title" }),
    body: field.richText(),
    tags: field.array(field.text()),
    seo: field.group({
      metaTitle: field.text(),
      featured: field.boolean(),
    }),
    author: field.relation("author"),
    coverImage: field.media({ accept: ["image/*"] }),
    status: field.select(["draft", "in_review", "published", "archived", "scheduled"], { default: "draft" }),
    publishedAt: field.datetime(),
    secret: field.text({ access: { read: ["admin"], write: ["admin"] } }),
    views: field.number(),
  },
})

const author = defineCollection({
  name: "author",
  fields: {
    name: field.text({ required: true }),
    secret: field.text({ access: { read: ["admin"] } }),
  },
})

const lockedPage = defineCollection({
  name: "locked_page",
  access: {
    read: ["admin"],
    create: ["admin"],
    update: ["admin"],
    delete: ["admin"],
  },
  fields: {
    title: field.text({ required: true }),
    slug: field.slug({ from: "title" }),
  },
})

describe("REST API handler", () => {
  let db: ReturnType<typeof createDatabase>
  let handler: (req: Request) => Promise<Response | null>
  let authorizedHandler: (req: Request) => Promise<Response | null>
  let editorHandler: (req: Request) => Promise<Response | null>
  let authorHandler: (req: Request) => Promise<Response | null>
  let viewerHandler: (req: Request) => Promise<Response | null>
  let auditEvents: Array<Record<string, unknown>>
  let collections: Map<string, any>
  let versioning: ReturnType<typeof createVersioningService>

  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    db.run(sql`CREATE TABLE IF NOT EXISTS page (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT,
      body TEXT,
      tags TEXT,
      seo TEXT,
      author_id TEXT,
      cover_image_id TEXT,
      status TEXT,
      published_at TEXT,
      secret TEXT,
      views INTEGER,
      created_at TEXT,
      updated_at TEXT
    )`)
    db.run(sql`CREATE TABLE IF NOT EXISTS author (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      secret TEXT,
      created_at TEXT,
      updated_at TEXT
    )`)
    db.run(sql`CREATE TABLE IF NOT EXISTS locked_page (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT,
      created_at TEXT,
      updated_at TEXT
    )`)
    db.run(sql`CREATE TABLE IF NOT EXISTS _versions (
      id TEXT PRIMARY KEY,
      collection TEXT NOT NULL,
      document_id TEXT NOT NULL,
      data TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      action TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`)
    bootstrapTables(db, [])

    const pageTable = generateTable(page)
    const authorTable = generateTable(author)
    const lockedPageTable = generateTable(lockedPage)
    versioning = createVersioningService(db)
    collections = new Map([
      ["page", { def: page, table: pageTable, service: createContentService(db, page, pageTable, versioning) }],
      ["author", { def: author, table: authorTable, service: createContentService(db, author, authorTable, versioning) }],
      ["locked_page", { def: lockedPage, table: lockedPageTable, service: createContentService(db, lockedPage, lockedPageTable, versioning) }],
    ])

    const media = {
      get: (id: string) => id === "media-1" ? { id, filename: "cover.png", url: `/api/media/${id}/file` } : null,
    }

    handler = createRestHandler(collections, versioning, undefined, undefined, undefined, { media })
    auditEvents = []
    authorizedHandler = createRestHandler(collections, versioning, undefined, undefined, undefined, {
      authorize: () => true,
      getRole: () => "admin",
      getActor: () => ({ userId: "admin-user", role: "admin" }),
      auditLog: {
        record: (event) => auditEvents.push(event),
      },
      media,
    })
    editorHandler = createRestHandler(collections, versioning, undefined, undefined, undefined, {
      authorize: () => true,
      getRole: () => "editor",
    })
    authorHandler = createRestHandler(collections, versioning, undefined, undefined, undefined, {
      authorize: () => true,
      getRole: () => "author",
    })
    viewerHandler = createRestHandler(collections, versioning, undefined, undefined, undefined, {
      authorize: () => true,
      getRole: () => "viewer",
    })
  })

  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("POST /api/page creates a document (201)", async () => {
    const req = new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hello World", slug: "hello-world" }),
    })
    const res = await authorizedHandler(req)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(201)
    const body = await res!.json()
    expect(body.id).toBeDefined()
    expect(body.title).toBe("Hello World")
    expect(body.status).toBe("draft")
  })

  test("POST and GET /api/page round-trip typed values", async () => {
    const bodyBlocks = [{ type: "paragraph", children: [{ text: "Typed body" }] }]
    const createRes = await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Typed Page",
        slug: "typed-page",
        body: bodyBlocks,
        tags: ["one", "two"],
        seo: { metaTitle: "Typed SEO", featured: true },
        author: "author-1",
        coverImage: "media-1",
      }),
    }))

    expect(createRes!.status).toBe(201)
    const created = await createRes!.json()
    expect(created.body).toEqual(bodyBlocks)
    expect(created.tags).toEqual(["one", "two"])
    expect(created.seo).toEqual({ metaTitle: "Typed SEO", featured: true })
    expect(created.author).toBe("author-1")
    expect(created.coverImage).toBe("media-1")
    expect(created.author_id).toBeUndefined()
    expect(created.cover_image_id).toBeUndefined()

    const getRes = await handler(new Request(`http://localhost/api/page/${created.id}`))
    const found = await getRes!.json()
    expect(found.body).toEqual(bodyBlocks)
    expect(found.tags).toEqual(["one", "two"])
    expect(found.seo).toEqual({ metaTitle: "Typed SEO", featured: true })
    expect(found.author).toBe("author-1")
    expect(found.coverImage).toBe("media-1")
  })

  test("POST /api/page returns validation errors for invalid input", async () => {
    const res = await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "missing-title" }),
    }))

    expect(res).not.toBeNull()
    expect(res!.status).toBe(400)
    const body = await res!.json()
    expect(body).toEqual({
      error: "Validation failed",
      issues: [{ path: "title", message: "Required field is missing" }],
    })
  })

  test("POST /api/page rejects anonymous writes", async () => {
    const req = new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Anonymous Write", slug: "anonymous-write" }),
    })
    const res = await handler(req)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(401)
    const body = await res!.json()
    expect(body.error).toBe("Unauthorized")
  })

  test("POST /api/_webhooks/:id/logs/:logId/replay replays a failed delivery", async () => {
    const webhookStore = createWebhookStore(db)
    const hook = webhookStore.create({
      url: "https://hooks.example.test/cms",
      events: ["content:afterPublish"],
      secret: "secret",
      active: true,
    })
    const failed = webhookStore.logDelivery({
      webhook_id: hook.id,
      event: "content:afterPublish",
      status: 500,
      request_body: JSON.stringify({ event: "content:afterPublish", data: { id: "page-1" } }),
      response_body: "server error",
      attempts: 1,
    })
    const webhookService = createWebhookService(webhookStore, {
      fetch: async () => new Response("ok", { status: 200 }),
      retryDelays: [],
    })
    const webhookHandler = createRestHandler(collections, versioning, undefined, webhookStore, undefined, {
      authorize: () => true,
      getRole: () => "admin",
      webhookService,
    })

    const res = await webhookHandler(new Request(`http://localhost/api/_webhooks/${hook.id}/logs/${failed.id}/replay`, {
      method: "POST",
    }))

    expect(res).not.toBeNull()
    expect(res!.status).toBe(200)
    const body = await res!.json()
    expect(body.status).toBe(200)
    expect(body.replayedFrom).toBe(failed.id)
    expect(webhookStore.getDeliveryLogs(hook.id)).toHaveLength(2)
  })

  test("collection access blocks disallowed REST reads and writes", async () => {
    const adminCreate = await authorizedHandler(new Request("http://localhost/api/locked_page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Locked", slug: "locked" }),
    }))
    expect(adminCreate!.status).toBe(201)
    const created = await adminCreate!.json()

    const publicRead = await handler(new Request(`http://localhost/api/locked_page/${created.id}`))
    expect(publicRead!.status).toBe(403)

    const editorCreate = await editorHandler(new Request("http://localhost/api/locked_page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Editor Locked", slug: "editor-locked" }),
    }))
    expect(editorCreate!.status).toBe(403)

    const editorUpdate = await editorHandler(new Request(`http://localhost/api/locked_page/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Editor Updated" }),
    }))
    expect(editorUpdate!.status).toBe(403)

    const editorDelete = await editorHandler(new Request(`http://localhost/api/locked_page/${created.id}`, {
      method: "DELETE",
    }))
    expect(editorDelete!.status).toBe(403)
  })

  test("default collection access lets viewers read but not mutate content", async () => {
    const adminCreate = await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Default ACL", slug: "default-acl" }),
    }))
    expect(adminCreate!.status).toBe(201)
    const created = await adminCreate!.json()

    const viewerRead = await viewerHandler(new Request(`http://localhost/api/page/${created.id}`))
    expect(viewerRead!.status).toBe(200)

    const anonymousCreate = await handler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Anonymous Write", slug: "anonymous-write" }),
    }))
    expect(anonymousCreate!.status).toBe(401)

    const viewerUpdate = await viewerHandler(new Request(`http://localhost/api/page/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Viewer Write" }),
    }))
    expect(viewerUpdate!.status).toBe(403)
  })

  test("GET /api/page lists documents (200, body.data)", async () => {
    // Create two docs first
    await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Page One", slug: "page-one" }),
    }))
    await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Page Two", slug: "page-two" }),
    }))

    const req = new Request("http://localhost/api/page")
    const res = await handler(req)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(200)
    const body = await res!.json()
    expect(body.data).toBeDefined()
    expect(body.data.length).toBe(2)
    expect(body.total).toBe(2)
  })

  test("GET /api/page supports pagination, sorting, and JSON where operators", async () => {
    await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Alpha", slug: "alpha", status: "draft", views: 1 }),
    }))
    await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Beta", slug: "beta", status: "published", views: 10 }),
    }))
    await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Gamma", slug: "gamma", status: "published", views: 5 }),
    }))

    const where = encodeURIComponent(JSON.stringify({ status: "published", views: { gt: 4 } }))
    const res = await handler(new Request(`http://localhost/api/page?where=${where}&sort=views&order=desc&limit=1&offset=0`))
    expect(res!.status).toBe(200)
    const body = await res!.json()

    expect(body.total).toBe(2)
    expect(body.limit).toBe(1)
    expect(body.offset).toBe(0)
    expect(body.data.map((doc: { title: string }) => doc.title)).toEqual(["Beta"])
  })

  test("GET /api/page rejects invalid query fields", async () => {
    const res = await handler(new Request("http://localhost/api/page?sort=unknown"))

    expect(res!.status).toBe(400)
    const body = await res!.json()
    expect(body.error).toContain("Unknown field")
  })

  test("GET /api/page/:id retrieves a document (200)", async () => {
    const createRes = await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Specific Page", slug: "specific-page" }),
    }))
    const created = await createRes!.json()

    const req = new Request(`http://localhost/api/page/${created.id}`)
    const res = await handler(req)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(200)
    const body = await res!.json()
    expect(body.title).toBe("Specific Page")
  })

  test("GET /api/page/:id?populate=author,coverImage expands relation and media fields", async () => {
    const authorRes = await authorizedHandler(new Request("http://localhost/api/author", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ada", secret: "admin-only" }),
    }))
    const createdAuthor = await authorRes!.json()

    const pageRes = await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Populated Page", slug: "populated-page", author: createdAuthor.id, coverImage: "media-1" }),
    }))
    const createdPage = await pageRes!.json()

    const res = await handler(new Request(`http://localhost/api/page/${createdPage.id}?populate=author,coverImage`))
    expect(res!.status).toBe(200)
    const body = await res!.json()
    expect(body.author).toEqual(expect.objectContaining({ id: createdAuthor.id, name: "Ada" }))
    expect(body.author.secret).toBeUndefined()
    expect(body.coverImage).toEqual({ id: "media-1", filename: "cover.png", url: "/api/media/media-1/file" })
  })

  test("GET /api/page/:id filters unreadable fields for public callers", async () => {
    const createRes = await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Private Page", slug: "private-page", secret: "admin-only" }),
    }))
    const created = await createRes!.json()

    const publicRes = await handler(new Request(`http://localhost/api/page/${created.id}`))
    expect(publicRes).not.toBeNull()
    expect(publicRes!.status).toBe(200)
    const publicBody = await publicRes!.json()
    expect(publicBody.title).toBe("Private Page")
    expect(publicBody.secret).toBeUndefined()

    const adminRes = await authorizedHandler(new Request(`http://localhost/api/page/${created.id}`))
    const adminBody = await adminRes!.json()
    expect(adminBody.secret).toBe("admin-only")
  })

  test("GET /api/page list and search filter unreadable fields", async () => {
    const createRes = await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Searchable Secret", slug: "searchable-secret", secret: "admin-only" }),
    }))
    const created = await createRes!.json()

    const search = {
      query: () => [{ collection: "page", document_id: created.id }],
    }
    const searchableHandler = createRestHandler(
      new Map([["page", { def: page, table: generateTable(page), service: createContentService(db, page, generateTable(page)) }]]),
      undefined,
      search,
    )

    const listRes = await handler(new Request("http://localhost/api/page"))
    const listBody = await listRes!.json()
    expect(listBody.data[0].secret).toBeUndefined()

    const searchRes = await searchableHandler(new Request("http://localhost/api/page?search=secret"))
    const searchBody = await searchRes!.json()
    expect(searchBody.data[0].secret).toBeUndefined()
  })

  test("GET /api/page/:id returns 404 for missing document", async () => {
    const req = new Request("http://localhost/api/page/nonexistent-id")
    const res = await handler(req)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(404)
    const body = await res!.json()
    expect(body.error).toBeDefined()
  })

  test("PATCH /api/page/:id updates a document (200)", async () => {
    const createRes = await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Original Title", slug: "original" }),
    }))
    const created = await createRes!.json()

    const req = new Request(`http://localhost/api/page/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Title" }),
    })
    const res = await authorizedHandler(req)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(200)
    const body = await res!.json()
    expect(body.title).toBe("Updated Title")
  })

  test("PATCH /api/page/:id rejects direct status transitions", async () => {
    const createRes = await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Workflow Patch", slug: "workflow-patch" }),
    }))
    const created = await createRes!.json()

    const res = await authorizedHandler(new Request(`http://localhost/api/page/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "published" }),
    }))

    expect(res!.status).toBe(400)
    const body = await res!.json()
    expect(body.error).toContain("Use a workflow action")
  })

  test("POST /api/page/:id/workflow transitions status and records audit events", async () => {
    const createRes = await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Workflow Page", slug: "workflow-page" }),
    }))
    const created = await createRes!.json()

    const reviewRes = await authorizedHandler(new Request(`http://localhost/api/page/${created.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit_review" }),
    }))
    expect(reviewRes!.status).toBe(200)
    const reviewed = await reviewRes!.json()
    expect(reviewed.status).toBe("in_review")

    const publishRes = await authorizedHandler(new Request(`http://localhost/api/page/${created.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "publish" }),
    }))
    expect(publishRes!.status).toBe(200)
    const published = await publishRes!.json()
    expect(published.status).toBe("published")

    expect(auditEvents.some((event) => event.action === "content.workflow.submit_review")).toBe(true)
    expect(auditEvents.some((event) => event.action === "content.workflow.publish")).toBe(true)
  })

  test("POST /api/page/:id/workflow enforces publish and archive role gates", async () => {
    const createRes = await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Author Workflow", slug: "author-workflow" }),
    }))
    const created = await createRes!.json()

    const submitRes = await authorHandler(new Request(`http://localhost/api/page/${created.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit_review" }),
    }))
    expect(submitRes!.status).toBe(200)
    expect((await submitRes!.json()).status).toBe("in_review")

    const publishRes = await authorHandler(new Request(`http://localhost/api/page/${created.id}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "publish" }),
    }))
    expect(publishRes!.status).toBe(403)
    expect((await publishRes!.json()).error).toContain("cannot publish")
  })

  test("POST /api/page/:id/schedule sets an ISO publish time and scheduled status", async () => {
    const createRes = await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Scheduled Page", slug: "scheduled-page" }),
    }))
    const created = await createRes!.json()

    const scheduleRes = await authorizedHandler(new Request(`http://localhost/api/page/${created.id}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publishedAt: "2026-05-31T05:00:00.000Z" }),
    }))

    expect(scheduleRes!.status).toBe(200)
    const scheduled = await scheduleRes!.json()
    expect(scheduled.status).toBe("scheduled")
    expect(scheduled.publishedAt).toBe("2026-05-31T05:00:00.000Z")
  })

  test("GET /api/page/:id/versions/:versionId/compare compares version data with current document", async () => {
    const createRes = await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Version One", slug: "version-one" }),
    }))
    const created = await createRes!.json()
    await authorizedHandler(new Request(`http://localhost/api/page/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Version Two" }),
    }))

    const versionsRes = await authorizedHandler(new Request(`http://localhost/api/page/${created.id}/versions`))
    const versionsBody = await versionsRes!.json()
    const originalVersion = versionsBody.data.find((version: any) => version.data.title === "Version One")

    const compareRes = await authorizedHandler(new Request(`http://localhost/api/page/${created.id}/versions/${originalVersion.id}/compare`))
    expect(compareRes!.status).toBe(200)
    const compare = await compareRes!.json()
    expect(compare.changes).toContainEqual({ field: "title", before: "Version Two", after: "Version One" })
  })

  test("POST /api/page/:id/versions/:versionId/restore restores version data and records audit", async () => {
    const createRes = await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Restore One", slug: "restore-one" }),
    }))
    const created = await createRes!.json()
    await authorizedHandler(new Request(`http://localhost/api/page/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Restore Two" }),
    }))

    const versionsRes = await authorizedHandler(new Request(`http://localhost/api/page/${created.id}/versions`))
    const versionsBody = await versionsRes!.json()
    const originalVersion = versionsBody.data.find((version: any) => version.data.title === "Restore One")

    const restoreRes = await authorizedHandler(new Request(`http://localhost/api/page/${created.id}/versions/${originalVersion.id}/restore`, {
      method: "POST",
    }))
    expect(restoreRes!.status).toBe(200)
    const restored = await restoreRes!.json()
    expect(restored.title).toBe("Restore One")
    expect(auditEvents.some((event) => event.action === "content.version.restored")).toBe(true)
  })

  test("PATCH /api/page/:id returns validation errors when clearing required fields", async () => {
    const createRes = await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Required Title", slug: "required-title" }),
    }))
    const created = await createRes!.json()

    const res = await authorizedHandler(new Request(`http://localhost/api/page/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    }))

    expect(res).not.toBeNull()
    expect(res!.status).toBe(400)
    const body = await res!.json()
    expect(body.issues).toEqual([{ path: "title", message: "Required field is missing" }])
  })

  test("POST and PATCH ignore fields the caller cannot write", async () => {
    const createRes = await editorHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Editor Page", slug: "editor-page", secret: "not-allowed" }),
    }))
    expect(createRes).not.toBeNull()
    expect(createRes!.status).toBe(201)
    const created = await createRes!.json()
    expect(created.secret).toBeUndefined()

    const adminRead = await authorizedHandler(new Request(`http://localhost/api/page/${created.id}`))
    const adminBody = await adminRead!.json()
    expect(adminBody.secret).toBeNull()

    await authorizedHandler(new Request(`http://localhost/api/page/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: "admin-secret" }),
    }))

    const editorPatch = await editorHandler(new Request(`http://localhost/api/page/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Editor Updated", secret: "editor-secret" }),
    }))
    const patched = await editorPatch!.json()
    expect(patched.title).toBe("Editor Updated")
    expect(patched.secret).toBeUndefined()

    const finalAdminRead = await authorizedHandler(new Request(`http://localhost/api/page/${created.id}`))
    const finalAdminBody = await finalAdminRead!.json()
    expect(finalAdminBody.secret).toBe("admin-secret")
  })

  test("POST /api/page/_bulk updates selected documents with writable fields only", async () => {
    const firstRes = await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Bulk One", slug: "bulk-one", secret: "first-secret" }),
    }))
    const secondRes = await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Bulk Two", slug: "bulk-two", secret: "second-secret" }),
    }))
    const first = await firstRes!.json()
    const second = await secondRes!.json()

    const bulkRes = await editorHandler(new Request("http://localhost/api/page/_bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        ids: [first.id, "missing-id", second.id],
        data: { title: "Bulk Edited", secret: "editor-secret" },
      }),
    }))

    expect(bulkRes!.status).toBe(200)
    const body = await bulkRes!.json()
    expect(body.updated.map((doc: { id: string }) => doc.id)).toEqual([first.id, second.id])
    expect(body.notFound).toEqual(["missing-id"])
    expect(body.updated.every((doc: { title: string }) => doc.title === "Bulk Edited")).toBe(true)
    expect(body.updated.every((doc: { secret?: string }) => doc.secret === undefined)).toBe(true)

    const adminRead = await authorizedHandler(new Request(`http://localhost/api/page/${first.id}`))
    const adminBody = await adminRead!.json()
    expect(adminBody.secret).toBe("first-secret")
  })

  test("POST /api/page/_bulk deletes selected documents and enforces collection ACL", async () => {
    const firstRes = await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Bulk Delete One", slug: "bulk-delete-one" }),
    }))
    const secondRes = await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Bulk Delete Two", slug: "bulk-delete-two" }),
    }))
    const first = await firstRes!.json()
    const second = await secondRes!.json()

    const deleteRes = await authorizedHandler(new Request("http://localhost/api/page/_bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", ids: [first.id, "missing-id", second.id] }),
    }))

    expect(deleteRes!.status).toBe(200)
    const body = await deleteRes!.json()
    expect(body.deleted).toEqual([first.id, second.id])
    expect(body.notFound).toEqual(["missing-id"])

    const lockedRes = await editorHandler(new Request("http://localhost/api/locked_page/_bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", ids: [first.id] }),
    }))
    expect(lockedRes!.status).toBe(403)
  })

  test("DELETE /api/page/:id removes a document (200, deleted: true)", async () => {
    const createRes = await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "To Delete", slug: "to-delete" }),
    }))
    const created = await createRes!.json()

    const req = new Request(`http://localhost/api/page/${created.id}`, {
      method: "DELETE",
    })
    const res = await authorizedHandler(req)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(200)
    const body = await res!.json()
    expect(body.deleted).toBe(true)
  })

  test("POST, PATCH, and DELETE write audit events with actor context", async () => {
    const createRes = await authorizedHandler(new Request("http://localhost/api/page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Audited", slug: "audited" }),
    }))
    const created = await createRes!.json()

    await authorizedHandler(new Request(`http://localhost/api/page/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Audited Updated" }),
    }))

    await authorizedHandler(new Request(`http://localhost/api/page/${created.id}`, {
      method: "DELETE",
    }))

    expect(auditEvents.map((event) => event.action)).toEqual([
      "content.created",
      "content.updated",
      "content.deleted",
    ])
    expect(auditEvents[0]).toMatchObject({
      actorId: "admin-user",
      actorRole: "admin",
      collection: "page",
      documentId: created.id,
    })
  })

  test("Unknown collection returns 404", async () => {
    const req = new Request("http://localhost/api/unknown-collection")
    const res = await handler(req)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(404)
    const body = await res!.json()
    expect(body.error).toContain("unknown-collection")
  })

  test("Non-API route returns null", async () => {
    const req = new Request("http://localhost/some/other/path")
    const res = await handler(req)
    expect(res).toBeNull()
  })
})
