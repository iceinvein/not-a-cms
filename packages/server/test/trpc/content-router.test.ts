import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { unlinkSync } from "node:fs"
import {
  createContentService,
  createDatabase,
  defineCollection,
  field,
  generateTable,
} from "@not-a-cms/core"
import { sql } from "drizzle-orm"
import { createNotACMSTRPCClient, resolveTRPCUrl } from "../../src/trpc/client"
import { createCallerFactory } from "../../src/trpc/context"
import { appRouter } from "../../src/trpc/router"

const testDbPath = "test-trpc.db"

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
    status: field.select(["draft", "published"], { default: "draft" }),
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

describe("content tRPC router", () => {
  let db: ReturnType<typeof createDatabase>
  let caller: any
  let editorCaller: any
  let viewerCaller: any
  let anonymousCaller: any

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

    const pageTable = generateTable(page)
    const authorTable = generateTable(author)
    const lockedPageTable = generateTable(lockedPage)
    const collections = new Map([
      ["page", { def: page, table: pageTable, service: createContentService(db, page, pageTable) }],
      [
        "author",
        { def: author, table: authorTable, service: createContentService(db, author, authorTable) },
      ],
      [
        "locked_page",
        {
          def: lockedPage,
          table: lockedPageTable,
          service: createContentService(db, lockedPage, lockedPageTable),
        },
      ],
    ])

    const trpcRouter = appRouter(collections)
    const createCaller = createCallerFactory(trpcRouter)
    caller = createCaller({ db, session: { userId: "test-user", role: "admin" } })
    editorCaller = createCaller({ db, session: { userId: "editor-user", role: "editor" } })
    viewerCaller = createCaller({ db, session: { userId: "viewer-user", role: "viewer" } })
    anonymousCaller = createCaller({ db, session: null })
  })

  afterEach(() => {
    try {
      unlinkSync(testDbPath)
    } catch {}
    try {
      unlinkSync(testDbPath + "-wal")
    } catch {}
    try {
      unlinkSync(testDbPath + "-shm")
    } catch {}
  })

  test("content.create creates a document", async () => {
    const doc = await caller.content.create({
      collection: "page",
      data: { title: "Test Page", slug: "test-page", status: "draft" },
    })
    expect(doc.id).toBeDefined()
    expect(doc.title).toBe("Test Page")
    expect(doc.status).toBe("draft")
  })

  test("content.create rejects invalid input with validation errors", async () => {
    await expect(
      caller.content.create({
        collection: "page",
        data: { slug: "missing-title" },
      }),
    ).rejects.toThrow("Validation failed")
  })

  test("content.create rejects anonymous callers", async () => {
    expect(
      anonymousCaller.content.create({
        collection: "page",
        data: { title: "Anonymous", slug: "anonymous" },
      }),
    ).rejects.toThrow("Not authenticated")
  })

  test("collection access blocks disallowed tRPC reads and writes", async () => {
    const created = await caller.content.create({
      collection: "locked_page",
      data: { title: "Locked", slug: "locked" },
    })

    await expect(
      anonymousCaller.content.findById({
        collection: "locked_page",
        id: created.id,
      }),
    ).rejects.toThrow("Forbidden")

    await expect(
      editorCaller.content.create({
        collection: "locked_page",
        data: { title: "Editor Locked", slug: "editor-locked" },
      }),
    ).rejects.toThrow("Forbidden")

    await expect(
      editorCaller.content.update({
        collection: "locked_page",
        id: created.id,
        data: { title: "Editor Updated" },
      }),
    ).rejects.toThrow("Forbidden")

    await expect(
      editorCaller.content.remove({
        collection: "locked_page",
        id: created.id,
      }),
    ).rejects.toThrow("Forbidden")
  })

  test("default collection access lets viewers read but not mutate content", async () => {
    const created = await caller.content.create({
      collection: "page",
      data: { title: "Default ACL", slug: "default-acl" },
    })

    const viewerRead = await viewerCaller.content.findById({ collection: "page", id: created.id })
    expect(viewerRead.title).toBe("Default ACL")

    await expect(
      viewerCaller.content.create({
        collection: "page",
        data: { title: "Viewer Create", slug: "viewer-create" },
      }),
    ).rejects.toThrow("Forbidden")

    await expect(
      viewerCaller.content.update({
        collection: "page",
        id: created.id,
        data: { title: "Viewer Update" },
      }),
    ).rejects.toThrow("Forbidden")
  })

  test("content.findById retrieves a document", async () => {
    const created = await caller.content.create({
      collection: "page",
      data: { title: "Find Me", slug: "find-me" },
    })
    const found = await caller.content.findById({
      collection: "page",
      id: created.id,
    })
    expect(found).toBeDefined()
    expect(found.title).toBe("Find Me")
  })

  test("content.create and content.findById round-trip typed values", async () => {
    const bodyBlocks = [{ type: "paragraph", children: [{ text: "Typed body" }] }]
    const created = await caller.content.create({
      collection: "page",
      data: {
        title: "Typed Page",
        slug: "typed-page",
        body: bodyBlocks,
        tags: ["one", "two"],
        seo: { metaTitle: "Typed SEO", featured: true },
        author: "author-1",
        coverImage: "media-1",
      },
    })

    expect(created.body).toEqual(bodyBlocks)
    expect(created.tags).toEqual(["one", "two"])
    expect(created.seo).toEqual({ metaTitle: "Typed SEO", featured: true })
    expect(created.author).toBe("author-1")
    expect(created.coverImage).toBe("media-1")
    expect(created.author_id).toBeUndefined()
    expect(created.cover_image_id).toBeUndefined()

    const found = await caller.content.findById({ collection: "page", id: created.id })
    expect(found.body).toEqual(bodyBlocks)
    expect(found.tags).toEqual(["one", "two"])
    expect(found.seo).toEqual({ metaTitle: "Typed SEO", featured: true })
    expect(found.author).toBe("author-1")
    expect(found.coverImage).toBe("media-1")
  })

  test("content.findById and findMany populate relation fields with ACL projection", async () => {
    const createdAuthor = await caller.content.create({
      collection: "author",
      data: { name: "Ada", secret: "admin-only" },
    })
    const createdPage = await caller.content.create({
      collection: "page",
      data: {
        title: "Populated Page",
        slug: "populated-page",
        status: "published",
        author: createdAuthor.id,
      },
    })

    const found = await anonymousCaller.content.findById({
      collection: "page",
      id: createdPage.id,
      populate: ["author"],
    })
    expect(found.author).toEqual(expect.objectContaining({ id: createdAuthor.id, name: "Ada" }))
    expect(found.author.secret).toBeUndefined()

    const list = await anonymousCaller.content.findMany({
      collection: "page",
      populate: ["author"],
    })
    expect(list[0].author).toEqual(expect.objectContaining({ id: createdAuthor.id, name: "Ada" }))
    expect(list[0].author.secret).toBeUndefined()
  })

  test("content.findById filters unreadable fields for anonymous callers", async () => {
    const created = await caller.content.create({
      collection: "page",
      data: {
        title: "Private Page",
        slug: "private-page",
        status: "published",
        secret: "admin-only",
      },
    })

    const anonymousFound = await anonymousCaller.content.findById({
      collection: "page",
      id: created.id,
    })
    expect(anonymousFound.title).toBe("Private Page")
    expect(anonymousFound.secret).toBeUndefined()

    const adminFound = await caller.content.findById({ collection: "page", id: created.id })
    expect(adminFound.secret).toBe("admin-only")
  })

  test("content.findMany lists documents", async () => {
    await caller.content.create({ collection: "page", data: { title: "A", slug: "a" } })
    await caller.content.create({ collection: "page", data: { title: "B", slug: "b" } })
    const all = await caller.content.findMany({ collection: "page" })
    expect(all.length).toBe(2)
  })

  test("content.findMany filters unreadable fields", async () => {
    await caller.content.create({
      collection: "page",
      data: { title: "Private", slug: "private", status: "published", secret: "admin-only" },
    })

    const all = await anonymousCaller.content.findMany({ collection: "page" })
    expect(all).toHaveLength(1)
    expect(all[0].title).toBe("Private")
    expect(all[0].secret).toBeUndefined()
  })

  test("anonymous callers can only read published content, never drafts", async () => {
    const draft = await caller.content.create({
      collection: "page",
      data: { title: "Hidden Draft", slug: "hidden-draft", status: "draft" },
    })
    const published = await caller.content.create({
      collection: "page",
      data: { title: "Shown", slug: "shown-published", status: "published" },
    })

    // findById: draft is hidden, published is visible
    expect(await anonymousCaller.content.findById({ collection: "page", id: draft.id })).toBeNull()
    const pub = await anonymousCaller.content.findById({ collection: "page", id: published.id })
    expect(pub?.title).toBe("Shown")

    // findMany: only published is returned
    const list = await anonymousCaller.content.findMany({ collection: "page" })
    expect(list.some((d: { id: string }) => d.id === draft.id)).toBe(false)
    expect(list.some((d: { id: string }) => d.id === published.id)).toBe(true)

    // authenticated admin still sees the draft
    const adminDraft = await caller.content.findById({ collection: "page", id: draft.id })
    expect(adminDraft?.title).toBe("Hidden Draft")
  })

  test("content.findMany supports sorting, operators, and metadata", async () => {
    await caller.content.create({
      collection: "page",
      data: { title: "Alpha", slug: "alpha", status: "draft", views: 1 },
    })
    await caller.content.create({
      collection: "page",
      data: { title: "Beta", slug: "beta", status: "published", views: 10 },
    })
    await caller.content.create({
      collection: "page",
      data: { title: "Gamma", slug: "gamma", status: "published", views: 5 },
    })

    const result = await caller.content.findMany({
      collection: "page",
      where: { status: "published", views: { gt: 4 } },
      sort: "views",
      order: "desc",
      limit: 1,
      offset: 0,
      withMeta: true,
    })

    expect(result.total).toBe(2)
    expect(result.limit).toBe(1)
    expect(result.offset).toBe(0)
    expect(result.data.map((doc: { title: string }) => doc.title)).toEqual(["Beta"])
  })

  test("content.findMany rejects unknown query fields", async () => {
    await expect(caller.content.findMany({ collection: "page", sort: "unknown" })).rejects.toThrow(
      "Unknown field",
    )
  })

  test("content.update modifies a document", async () => {
    const created = await caller.content.create({
      collection: "page",
      data: { title: "Original", slug: "original" },
    })
    const updated = await caller.content.update({
      collection: "page",
      id: created.id,
      data: { title: "Updated" },
    })
    expect(updated.title).toBe("Updated")
  })

  test("content.create and content.update ignore fields the caller cannot write", async () => {
    const created = await editorCaller.content.create({
      collection: "page",
      data: { title: "Editor Page", slug: "editor-page", secret: "not-allowed" },
    })
    expect(created.secret).toBeUndefined()

    const adminRead = await caller.content.findById({ collection: "page", id: created.id })
    expect(adminRead.secret).toBeNull()

    await caller.content.update({
      collection: "page",
      id: created.id,
      data: { secret: "admin-secret" },
    })

    const editorUpdated = await editorCaller.content.update({
      collection: "page",
      id: created.id,
      data: { title: "Editor Updated", secret: "editor-secret" },
    })
    expect(editorUpdated.title).toBe("Editor Updated")
    expect(editorUpdated.secret).toBeUndefined()

    const finalAdminRead = await caller.content.findById({ collection: "page", id: created.id })
    expect(finalAdminRead.secret).toBe("admin-secret")
  })

  test("content.remove deletes a document", async () => {
    const created = await caller.content.create({
      collection: "page",
      data: { title: "Delete Me", slug: "delete-me" },
    })
    const result = await caller.content.remove({
      collection: "page",
      id: created.id,
    })
    expect(result).toBe(true)
  })

  test("content.create throws for unknown collection", async () => {
    expect(caller.content.create({ collection: "unknown", data: { title: "X" } })).rejects.toThrow()
  })

  test("client helpers build typed tRPC clients from API base URLs", () => {
    expect(resolveTRPCUrl("http://localhost:4321")).toBe("http://localhost:4321/trpc")
    expect(resolveTRPCUrl("http://localhost:4321/")).toBe("http://localhost:4321/trpc")
    expect(resolveTRPCUrl("http://localhost:4321/custom/trpc")).toBe(
      "http://localhost:4321/custom/trpc",
    )

    const client = createNotACMSTRPCClient({
      apiBase: "http://localhost:4321",
      fetch: globalThis.fetch,
    })

    expect(typeof client.content.findMany.query).toBe("function")
    expect(typeof client.content.create.mutate).toBe("function")
  })
})
