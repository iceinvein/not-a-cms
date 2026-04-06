# Phase C: The Differentiators — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Features that make not-a-cms better than WordPress, Ghost, and Payload — GraphQL API, webhooks, scheduled publishing, preview links, role-based field visibility, theme customizer, email rendering, and WordPress import.

**Architecture:** Eight independent features layered on top of the Phase B production foundation. GraphQL auto-generates a Pothos schema from collection definitions. Webhooks extend the existing hook system with outbound HTTP delivery. Scheduled publishing uses setInterval to promote draft-to-published. Preview tokens enable shareable draft links. Role-based visibility filters fields in the admin based on user role. Theme customizer stores settings in DB and reads at render time. Email channel uses MJML to render Portable Text. WordPress import parses WXR XML into collections.

**Tech Stack:** Pothos (GraphQL), graphql-yoga, MJML, crypto (preview tokens)

---

## Execution Waves

```
Wave 1 (parallel):  C3 Scheduled Publishing  |  C2 Webhooks              |  C8 WordPress Import
Wave 2 (parallel):  C1 GraphQL Endpoint      |  C4 Content Preview       |  C5 Role-Based Fields
Wave 3 (parallel):  C6 Theme Customizer      |  C7 Email Channel Rendering
```

---

## File Structure (all changes)

```
packages/
  core/src/
    content/
      scheduler.ts                CREATE - scheduled publishing cron
    webhooks/
      types.ts                    CREATE - webhook config + event types
      service.ts                  CREATE - webhook delivery + retry + logging
      store.ts                    CREATE - webhook CRUD (DB-backed)
    preview/
      tokens.ts                   CREATE - preview token generation + validation
    roles/
      field-filter.ts             CREATE - filter fields by role
    settings/
      service.ts                  CREATE - key-value settings store
    import/
      wordpress.ts                CREATE - WXR parser + Portable Text converter
    db/
      bootstrap.ts                MODIFY - add _webhooks, _webhook_logs, _preview_tokens, _settings tables
    index.ts                      MODIFY - export new modules
  core/test/
    content/scheduler.test.ts     CREATE
    webhooks/service.test.ts      CREATE
    preview/tokens.test.ts        CREATE
    roles/field-filter.test.ts    CREATE
    settings/service.test.ts      CREATE
    import/wordpress.test.ts      CREATE
  server/src/
    graphql/
      schema.ts                   CREATE - Pothos schema from collections
      handler.ts                  CREATE - /graphql endpoint + playground
    preview/
      handler.ts                  CREATE - /preview/:token route
    rest/
      handler.ts                  MODIFY - add webhook CRUD routes, settings routes
    index.ts                      MODIFY - mount GraphQL, preview, webhooks, scheduler
  server/test/
    graphql/schema.test.ts        CREATE
    preview/handler.test.ts       CREATE
  admin/src/
    components/
      WebhookManager.tsx          CREATE - webhook list + create/edit/delete
      WebhookLog.tsx              CREATE - delivery log viewer
      PreviewLink.tsx             CREATE - generate + copy preview link
      ThemeCustomizer.tsx         CREATE - visual theme settings editor
      ContentEditor.tsx           MODIFY - add preview link, role-based field hiding
      ContentList.tsx             MODIFY - show scheduled badge
    pages/
      webhooks.astro              CREATE - webhook management page
  renderer/src/
    runtime/
      email-channel.ts            CREATE - MJML renderer for Portable Text
    pages/
      preview/[token].astro       CREATE - preview page (token-based, no auth)
  renderer/test/
    runtime/email-channel.test.ts CREATE
  cli/src/
    commands/
      import.ts                   CREATE - not-a-cms import wordpress <file>
    bin.ts                        MODIFY - register import command
```

---

## Task C3: Scheduled Publishing

**Files:**
- Create: `packages/core/src/content/scheduler.ts`
- Create: `packages/core/test/content/scheduler.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/server/src/index.ts`
- Modify: `packages/admin/src/components/ContentList.tsx`

### Step 1: Write failing tests

- [ ] **Create test file**

```typescript
// packages/core/test/content/scheduler.test.ts
import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { unlinkSync } from "node:fs"
import { createDatabase } from "../../src/db/connection"
import { bootstrapTables } from "../../src/db/bootstrap"
import { defineCollection } from "../../src/schema/collection"
import { field } from "../../src/schema/field"
import { generateTable } from "../../src/db/generate-table"
import { createContentService } from "../../src/content/service"
import { createScheduler } from "../../src/content/scheduler"

const testDbPath = "test-scheduler.db"

const blogPost = defineCollection({
  name: "blog_post",
  labels: { singular: "Blog Post", plural: "Blog Posts" },
  fields: {
    title: field.text({ required: true }),
    status: field.select(["draft", "published", "scheduled"], { default: "draft" }),
    publishedAt: field.datetime(),
  },
})

let db: ReturnType<typeof createDatabase>
let service: ReturnType<typeof createContentService>

describe("createScheduler", () => {
  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [blogPost])
    const table = generateTable(blogPost)
    service = createContentService(db, blogPost, table)
  })

  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("promoteScheduled() publishes posts with past publishedAt", async () => {
    const past = new Date(Date.now() - 60000).toISOString()
    await service.create({ title: "Scheduled Post", status: "scheduled", published_at: past })
    await service.create({ title: "Draft Post", status: "draft" })

    const collections = new Map()
    collections.set("blog_post", { def: blogPost, table: generateTable(blogPost), service })

    const scheduler = createScheduler(collections)
    const promoted = await scheduler.promoteScheduled()

    expect(promoted).toHaveLength(1)
    expect(promoted[0].title).toBe("Scheduled Post")

    const all = await service.findMany()
    const scheduled = all.find((p) => p.title === "Scheduled Post")
    expect(scheduled?.status).toBe("published")
  })

  test("promoteScheduled() ignores future publishedAt", async () => {
    const future = new Date(Date.now() + 3600000).toISOString()
    await service.create({ title: "Future Post", status: "scheduled", published_at: future })

    const collections = new Map()
    collections.set("blog_post", { def: blogPost, table: generateTable(blogPost), service })

    const scheduler = createScheduler(collections)
    const promoted = await scheduler.promoteScheduled()
    expect(promoted).toHaveLength(0)
  })
})
```

- [ ] **Run to verify failure**

Run: `cd packages/core && bun test test/content/scheduler.test.ts`

### Step 2: Implement scheduler

- [ ] **Create scheduler.ts**

```typescript
// packages/core/src/content/scheduler.ts
import type { createContentService } from "./service"
import type { CollectionDef } from "../types"

type CollectionEntry = {
  def: CollectionDef
  table: any
  service: ReturnType<typeof createContentService>
}

export function createScheduler(collections: Map<string, CollectionEntry>) {
  async function promoteScheduled(): Promise<Record<string, unknown>[]> {
    const now = new Date().toISOString()
    const promoted: Record<string, unknown>[] = []

    for (const [, entry] of collections) {
      const { service } = entry
      const all = await service.findMany({ where: { status: "scheduled" } })
      for (const doc of all) {
        const publishedAt = doc.published_at as string | null
        if (publishedAt && publishedAt <= now) {
          const updated = await service.update(doc.id as string, { status: "published" })
          promoted.push(updated)
        }
      }
    }

    return promoted
  }

  return { promoteScheduled }
}

export type Scheduler = ReturnType<typeof createScheduler>
```

- [ ] **Run tests**

Run: `cd packages/core && bun test test/content/scheduler.test.ts`

- [ ] **Export from core**

Add to `packages/core/src/index.ts`:
```typescript
// Scheduler
export { createScheduler, type Scheduler } from "./content/scheduler"
```

- [ ] **Commit**

```bash
git add packages/core/src/content/scheduler.ts packages/core/test/content/scheduler.test.ts packages/core/src/index.ts
git commit -m "feat(core): add scheduled publishing - promote posts with past publishedAt"
```

### Step 3: Wire into server and add scheduled badge to admin

- [ ] **Add interval to server/src/index.ts**

After the server creation, add:
```typescript
import { createScheduler } from "@not-a-cms/core"

// After server const:
const scheduler = createScheduler(collections)
setInterval(async () => {
  try {
    const promoted = await scheduler.promoteScheduled()
    if (promoted.length > 0 && !process.env.QUIET) {
      console.log(`  Scheduled publishing: promoted ${promoted.length} post(s)`)
    }
  } catch {}
}, 60_000)
```

- [ ] **Add scheduled badge to ContentList.tsx**

In the `statusBadge` function, add:
```typescript
scheduled: "bg-purple-100 text-purple-700",
```

- [ ] **Commit**

```bash
git add packages/server/src/index.ts packages/admin/src/components/ContentList.tsx
git commit -m "feat: wire scheduled publishing cron and add scheduled status badge"
```

---

## Task C2: Webhook System

**Files:**
- Create: `packages/core/src/webhooks/types.ts`
- Create: `packages/core/src/webhooks/store.ts`
- Create: `packages/core/src/webhooks/service.ts`
- Create: `packages/core/test/webhooks/service.test.ts`
- Modify: `packages/core/src/db/bootstrap.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/server/src/rest/handler.ts`
- Modify: `packages/server/src/index.ts`
- Create: `packages/admin/src/components/WebhookManager.tsx`
- Create: `packages/admin/src/pages/webhooks.astro`

### Step 1: Create types and bootstrap tables

- [ ] **Create types.ts**

```typescript
// packages/core/src/webhooks/types.ts
export type WebhookEvent =
  | "content:afterSave"
  | "content:afterPublish"
  | "content:afterDelete"
  | "media:afterUpload"

export type WebhookConfig = {
  id: string
  url: string
  events: WebhookEvent[]
  collection?: string
  secret?: string
  active: boolean
  created_at: string
}

export type WebhookDelivery = {
  id: string
  webhook_id: string
  event: WebhookEvent
  status: number
  request_body: string
  response_body?: string
  attempts: number
  created_at: string
}
```

- [ ] **Add tables to bootstrap.ts**

After the FTS table creation in `packages/core/src/db/bootstrap.ts`:

```typescript
  db.run(sql`${sql.raw(`CREATE TABLE IF NOT EXISTS _webhooks (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    events TEXT NOT NULL,
    collection TEXT,
    secret TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`)}`)

  db.run(sql`${sql.raw(`CREATE TABLE IF NOT EXISTS _webhook_logs (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    event TEXT NOT NULL,
    status INTEGER NOT NULL,
    request_body TEXT NOT NULL,
    response_body TEXT,
    attempts INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`)}`)
```

### Step 2: Write failing tests

- [ ] **Create test file**

```typescript
// packages/core/test/webhooks/service.test.ts
import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { unlinkSync } from "node:fs"
import { createDatabase } from "../../src/db/connection"
import { bootstrapTables } from "../../src/db/bootstrap"
import { createWebhookStore } from "../../src/webhooks/store"
import { createWebhookService } from "../../src/webhooks/service"

const testDbPath = "test-webhooks.db"
let db: ReturnType<typeof createDatabase>
let store: ReturnType<typeof createWebhookStore>
let webhookService: ReturnType<typeof createWebhookService>

describe("webhook system", () => {
  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [])
    store = createWebhookStore(db)
    webhookService = createWebhookService(store)
  })

  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("store.create() creates a webhook", () => {
    const hook = store.create({ url: "https://example.com/webhook", events: ["content:afterPublish"], active: true })
    expect(hook.id).toBeDefined()
    expect(hook.url).toBe("https://example.com/webhook")
  })

  test("store.list() returns all webhooks", () => {
    store.create({ url: "https://a.com", events: ["content:afterSave"], active: true })
    store.create({ url: "https://b.com", events: ["content:afterDelete"], active: true })
    expect(store.list()).toHaveLength(2)
  })

  test("store.remove() deletes a webhook", () => {
    const hook = store.create({ url: "https://a.com", events: ["content:afterSave"], active: true })
    store.remove(hook.id)
    expect(store.list()).toHaveLength(0)
  })

  test("store.update() modifies a webhook", () => {
    const hook = store.create({ url: "https://a.com", events: ["content:afterSave"], active: true })
    const updated = store.update(hook.id, { url: "https://b.com" })
    expect(updated?.url).toBe("https://b.com")
  })

  test("service.getMatchingWebhooks() returns hooks matching event and collection", () => {
    store.create({ url: "https://a.com", events: ["content:afterPublish"], collection: "blog_post", active: true })
    store.create({ url: "https://b.com", events: ["content:afterPublish"], active: true })
    store.create({ url: "https://c.com", events: ["content:afterDelete"], active: true })
    const matches = webhookService.getMatchingWebhooks("content:afterPublish", "blog_post")
    expect(matches).toHaveLength(2)
  })

  test("service.getMatchingWebhooks() excludes inactive webhooks", () => {
    store.create({ url: "https://a.com", events: ["content:afterPublish"], active: false })
    expect(webhookService.getMatchingWebhooks("content:afterPublish", "blog_post")).toHaveLength(0)
  })

  test("store.logDelivery() records a delivery", () => {
    const hook = store.create({ url: "https://a.com", events: ["content:afterPublish"], active: true })
    store.logDelivery({ webhook_id: hook.id, event: "content:afterPublish", status: 200, request_body: '{"test":true}', response_body: "ok", attempts: 1 })
    const logs = store.getDeliveryLogs(hook.id)
    expect(logs).toHaveLength(1)
    expect(logs[0].status).toBe(200)
  })
})
```

### Step 3: Implement store and service

- [ ] **Create store.ts**

```typescript
// packages/core/src/webhooks/store.ts
import { sql } from "drizzle-orm"
import type { AppDatabase } from "../db/connection"
import type { WebhookConfig, WebhookDelivery, WebhookEvent } from "./types"

type CreateWebhookInput = {
  url: string
  events: WebhookEvent[]
  collection?: string
  secret?: string
  active: boolean
}

export function createWebhookStore(db: AppDatabase) {
  function create(input: CreateWebhookInput): WebhookConfig {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const eventsJson = JSON.stringify(input.events)
    db.run(sql`INSERT INTO _webhooks (id, url, events, collection, secret, active, created_at) VALUES (${id}, ${input.url}, ${eventsJson}, ${input.collection ?? null}, ${input.secret ?? null}, ${input.active ? 1 : 0}, ${now})`)
    return { id, ...input, created_at: now }
  }

  function list(): WebhookConfig[] {
    const rows = db.all(sql`SELECT * FROM _webhooks ORDER BY created_at DESC`)
    return (rows as any[]).map(parseRow)
  }

  function getById(id: string): WebhookConfig | null {
    const rows = db.all(sql`SELECT * FROM _webhooks WHERE id = ${id}`)
    const row = (rows as any[])[0]
    return row ? parseRow(row) : null
  }

  function update(id: string, data: Partial<CreateWebhookInput>): WebhookConfig | null {
    const existing = getById(id)
    if (!existing) return null
    const merged = { ...existing, ...data }
    db.run(sql`UPDATE _webhooks SET url = ${merged.url}, events = ${JSON.stringify(merged.events)}, collection = ${merged.collection ?? null}, secret = ${merged.secret ?? null}, active = ${merged.active ? 1 : 0} WHERE id = ${id}`)
    return getById(id)
  }

  function remove(id: string): boolean {
    db.run(sql`DELETE FROM _webhooks WHERE id = ${id}`)
    return true
  }

  function logDelivery(input: Omit<WebhookDelivery, "id" | "created_at">): void {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    db.run(sql`INSERT INTO _webhook_logs (id, webhook_id, event, status, request_body, response_body, attempts, created_at) VALUES (${id}, ${input.webhook_id}, ${input.event}, ${input.status}, ${input.request_body}, ${input.response_body ?? null}, ${input.attempts}, ${now})`)
  }

  function getDeliveryLogs(webhookId: string, limit = 50): WebhookDelivery[] {
    const rows = db.all(sql`SELECT * FROM _webhook_logs WHERE webhook_id = ${webhookId} ORDER BY created_at DESC LIMIT ${limit}`)
    return rows as WebhookDelivery[]
  }

  return { create, list, getById, update, remove, logDelivery, getDeliveryLogs }
}

function parseRow(row: any): WebhookConfig {
  return { ...row, events: typeof row.events === "string" ? JSON.parse(row.events) : row.events, active: Boolean(row.active) }
}

export type WebhookStore = ReturnType<typeof createWebhookStore>
```

- [ ] **Create service.ts**

```typescript
// packages/core/src/webhooks/service.ts
import type { WebhookStore } from "./store"
import type { WebhookConfig, WebhookEvent } from "./types"

const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 5000, 30000]

export function createWebhookService(store: WebhookStore) {
  function getMatchingWebhooks(event: WebhookEvent, collection: string): WebhookConfig[] {
    return store.list().filter((hook) => {
      if (!hook.active) return false
      if (!hook.events.includes(event)) return false
      if (hook.collection && hook.collection !== collection) return false
      return true
    })
  }

  async function dispatch(event: WebhookEvent, collection: string, payload: Record<string, unknown>): Promise<void> {
    const hooks = getMatchingWebhooks(event, collection)
    for (const hook of hooks) {
      const body = JSON.stringify({ event, collection, data: payload, timestamp: new Date().toISOString() })
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (hook.secret) {
        const encoder = new TextEncoder()
        const key = await crypto.subtle.importKey("raw", encoder.encode(hook.secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
        const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body))
        headers["X-Webhook-Signature"] = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("")
      }
      deliver(hook, body, headers, 1)
    }
  }

  async function deliver(hook: WebhookConfig, body: string, headers: Record<string, string>, attempt: number): Promise<void> {
    try {
      const res = await fetch(hook.url, { method: "POST", headers, body, signal: AbortSignal.timeout(10000) })
      store.logDelivery({ webhook_id: hook.id, event: hook.events[0], status: res.status, request_body: body, response_body: await res.text().catch(() => ""), attempts: attempt })
      if (!res.ok && attempt < MAX_RETRIES) {
        setTimeout(() => deliver(hook, body, headers, attempt + 1), RETRY_DELAYS[attempt - 1])
      }
    } catch (err: any) {
      store.logDelivery({ webhook_id: hook.id, event: hook.events[0], status: 0, request_body: body, response_body: err.message, attempts: attempt })
      if (attempt < MAX_RETRIES) {
        setTimeout(() => deliver(hook, body, headers, attempt + 1), RETRY_DELAYS[attempt - 1])
      }
    }
  }

  return { getMatchingWebhooks, dispatch }
}

export type WebhookService = ReturnType<typeof createWebhookService>
```

- [ ] **Run tests, export, commit**

Run: `cd packages/core && bun test test/webhooks/service.test.ts`

Add to `packages/core/src/index.ts`:
```typescript
// Webhooks
export { createWebhookStore, type WebhookStore } from "./webhooks/store"
export { createWebhookService, type WebhookService } from "./webhooks/service"
export type { WebhookConfig, WebhookDelivery, WebhookEvent } from "./webhooks/types"
```

```bash
git add packages/core/src/webhooks/ packages/core/test/webhooks/ packages/core/src/db/bootstrap.ts packages/core/src/index.ts
git commit -m "feat(core): add webhook system with store, delivery, retry, and HMAC signing"
```

### Step 4: Wire into server + admin

- [ ] **Add webhook CRUD routes to REST handler, create admin WebhookManager, wire into server**

Add `/api/_webhooks` CRUD routes in `handler.ts`. Create `WebhookManager.tsx` and `webhooks.astro`. Wire webhook dispatch into content save/publish/delete in server index. Add sidebar link.

```bash
git add packages/server/ packages/admin/
git commit -m "feat: wire webhook system with REST API, delivery on content events, and admin UI"
```

---

## Task C1: GraphQL Endpoint

**Files:**
- Create: `packages/server/src/graphql/schema.ts`
- Create: `packages/server/src/graphql/handler.ts`
- Create: `packages/server/test/graphql/schema.test.ts`
- Modify: `packages/server/src/index.ts`
- Modify: `packages/server/package.json`

### Step 1: Install dependencies and write tests

- [ ] **Install**

Run: `cd packages/server && bun add @pothos/core graphql graphql-yoga`

- [ ] **Create test file**

```typescript
// packages/server/test/graphql/schema.test.ts
import { test, expect, describe, beforeAll, afterAll } from "bun:test"
import { unlinkSync } from "node:fs"
import { createServer } from "../../src/index"
import { defineCollection, field } from "@not-a-cms/core"

const testDbPath = "test-graphql.db"

const blogPost = defineCollection({
  name: "blog_post",
  labels: { singular: "Blog Post", plural: "Blog Posts" },
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    slug: field.slug({ from: "title" }),
    body: field.richText(),
    status: field.select(["draft", "published"], { default: "draft" }),
    views: field.number(),
    featured: field.boolean(),
  },
})

let baseUrl: string
let server: ReturnType<typeof createServer>

describe("GraphQL endpoint", () => {
  beforeAll(async () => {
    server = createServer({
      port: 0,
      database: { url: testDbPath },
      auth: { secret: "a".repeat(32), baseURL: "http://localhost", magicLink: { sendMagicLink: async () => {} } },
      collections: [blogPost],
    })
    baseUrl = `http://localhost:${server.server.port}`
    await fetch(`${baseUrl}/api/blog_post`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "First Post", slug: "first-post", status: "published" }) })
    await fetch(`${baseUrl}/api/blog_post`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Draft Post", slug: "draft-post", status: "draft" }) })
  })

  afterAll(() => {
    server.server.stop()
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("POST /graphql executes a list query", async () => {
    const res = await fetch(`${baseUrl}/graphql`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: `{ blogPosts { id title slug status } }` }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.data.blogPosts).toHaveLength(2)
  })

  test("supports where argument as JSON string", async () => {
    const res = await fetch(`${baseUrl}/graphql`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: `{ blogPosts(where: "{\\"status\\":\\"published\\"}") { title } }` }) })
    const data = await res.json()
    expect(data.data.blogPosts).toHaveLength(1)
    expect(data.data.blogPosts[0].title).toBe("First Post")
  })

  test("supports limit argument", async () => {
    const res = await fetch(`${baseUrl}/graphql`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: `{ blogPosts(limit: 1) { title } }` }) })
    const data = await res.json()
    expect(data.data.blogPosts).toHaveLength(1)
  })

  test("supports single item query by id", async () => {
    const listRes = await fetch(`${baseUrl}/api/blog_post`)
    const listData = await listRes.json()
    const id = listData.data[0].id
    const res = await fetch(`${baseUrl}/graphql`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: `{ blogPost(id: "${id}") { id title } }` }) })
    const data = await res.json()
    expect(data.data.blogPost.id).toBe(id)
  })
})
```

### Step 2: Implement schema and handler

- [ ] **Create schema.ts** — Pothos schema builder that iterates collections and creates object types + query fields with list/single resolvers
- [ ] **Create handler.ts** — graphql-yoga handler mounted at /graphql
- [ ] **Mount in server/src/index.ts** — add /graphql route before REST routes
- [ ] **Run tests, commit**

```bash
git add packages/server/src/graphql/ packages/server/test/graphql/ packages/server/src/index.ts packages/server/package.json
git commit -m "feat(server): auto-generate GraphQL endpoint from collection schemas with Pothos"
```

---

## Task C4: Content Preview

**Files:**
- Create: `packages/core/src/preview/tokens.ts`
- Create: `packages/core/test/preview/tokens.test.ts`
- Modify: `packages/core/src/db/bootstrap.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/server/src/preview/handler.ts`
- Modify: `packages/server/src/index.ts`
- Create: `packages/admin/src/components/PreviewLink.tsx`
- Modify: `packages/admin/src/components/ContentEditor.tsx`
- Create: `packages/renderer/src/pages/preview/[token].astro`

### Step 1: Bootstrap table and write tests

- [ ] **Add _preview_tokens table to bootstrap.ts**

```typescript
  db.run(sql`${sql.raw(`CREATE TABLE IF NOT EXISTS _preview_tokens (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    collection TEXT NOT NULL,
    document_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`)}`)
```

- [ ] **Create test file**

```typescript
// packages/core/test/preview/tokens.test.ts
import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { unlinkSync } from "node:fs"
import { createDatabase } from "../../src/db/connection"
import { bootstrapTables } from "../../src/db/bootstrap"
import { createPreviewTokenService } from "../../src/preview/tokens"

const testDbPath = "test-preview.db"
let db: ReturnType<typeof createDatabase>
let tokenService: ReturnType<typeof createPreviewTokenService>

describe("preview tokens", () => {
  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [])
    tokenService = createPreviewTokenService(db)
  })

  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("generate() creates a token", () => {
    const t = tokenService.generate("blog_post", "doc-123")
    expect(t.token.length).toBeGreaterThan(20)
    expect(t.collection).toBe("blog_post")
    expect(t.document_id).toBe("doc-123")
  })

  test("validate() returns info for valid token", () => {
    const t = tokenService.generate("blog_post", "doc-123")
    const result = tokenService.validate(t.token)
    expect(result).not.toBeNull()
    expect(result!.collection).toBe("blog_post")
  })

  test("validate() returns null for invalid token", () => {
    expect(tokenService.validate("bad-token")).toBeNull()
  })

  test("validate() returns null for expired token", () => {
    const t = tokenService.generate("blog_post", "doc-123", -1)
    expect(tokenService.validate(t.token)).toBeNull()
  })

  test("generate() reuses valid token for same document", () => {
    const t1 = tokenService.generate("blog_post", "doc-123")
    const t2 = tokenService.generate("blog_post", "doc-123")
    expect(t1.token).toBe(t2.token)
  })
})
```

### Step 2: Implement token service

- [ ] **Create tokens.ts**

```typescript
// packages/core/src/preview/tokens.ts
import { sql } from "drizzle-orm"
import type { AppDatabase } from "../db/connection"

const DEFAULT_TTL_HOURS = 72

export function createPreviewTokenService(db: AppDatabase) {
  function generate(collection: string, documentId: string, ttlHours = DEFAULT_TTL_HOURS) {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString()

    const existing = db.all(sql`SELECT * FROM _preview_tokens WHERE collection = ${collection} AND document_id = ${documentId} AND expires_at > ${now.toISOString()}`) as any[]
    if (existing.length > 0) {
      return { token: existing[0].token, collection, document_id: documentId, expires_at: existing[0].expires_at }
    }

    const token = crypto.randomUUID() + "-" + crypto.randomUUID()
    const id = crypto.randomUUID()
    db.run(sql`INSERT INTO _preview_tokens (id, token, collection, document_id, expires_at, created_at) VALUES (${id}, ${token}, ${collection}, ${documentId}, ${expiresAt}, ${now.toISOString()})`)
    return { token, collection, document_id: documentId, expires_at: expiresAt }
  }

  function validate(token: string): { collection: string; document_id: string } | null {
    const now = new Date().toISOString()
    const rows = db.all(sql`SELECT * FROM _preview_tokens WHERE token = ${token} AND expires_at > ${now}`) as any[]
    if (rows.length === 0) return null
    return { collection: rows[0].collection, document_id: rows[0].document_id }
  }

  return { generate, validate }
}

export type PreviewTokenService = ReturnType<typeof createPreviewTokenService>
```

- [ ] **Run tests, export, commit**

Run: `cd packages/core && bun test test/preview/tokens.test.ts`

Add to core index: `export { createPreviewTokenService, type PreviewTokenService } from "./preview/tokens"`

```bash
git add packages/core/src/preview/ packages/core/test/preview/ packages/core/src/db/bootstrap.ts packages/core/src/index.ts
git commit -m "feat(core): add preview token generation and validation"
```

### Step 3: Wire preview into server, admin, and renderer

- [ ] **Create server preview handler** — POST `/api/_preview/generate` and GET `/preview/:token`
- [ ] **Create PreviewLink.tsx** — button in editor sidebar, generates and copies shareable link
- [ ] **Create preview/[token].astro** — validates token, fetches document, renders with portableTextToHtml
- [ ] **Commit**

```bash
git add packages/server/src/preview/ packages/admin/src/components/PreviewLink.tsx packages/admin/src/components/ContentEditor.tsx packages/renderer/src/pages/preview/
git commit -m "feat: add shareable preview links for draft content"
```

---

## Task C5: Role-Based Field Visibility

**Files:**
- Create: `packages/core/src/roles/field-filter.ts`
- Create: `packages/core/test/roles/field-filter.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/server/src/schema/handler.ts`

### Step 1: Write tests and implement

- [ ] **Create test file**

```typescript
// packages/core/test/roles/field-filter.test.ts
import { test, expect, describe } from "bun:test"
import { filterFieldsByRole } from "../../src/roles/field-filter"
import { field } from "../../src/schema/field"

describe("filterFieldsByRole", () => {
  const fields = {
    title: field.text({ required: true }),
    body: field.richText(),
    status: field.select(["draft", "published"]),
    layout: field.select(["default", "sidebar"], { access: { write: ["admin", "editor"] } }),
    customCSS: field.text({ access: { write: ["admin"] } }),
    secret: field.text({ access: { read: ["admin"] } }),
  }

  test("admin sees all fields", () => {
    expect(Object.keys(filterFieldsByRole(fields, "admin"))).toHaveLength(6)
  })

  test("editor sees all except admin-only read fields", () => {
    const visible = filterFieldsByRole(fields, "editor")
    expect(Object.keys(visible)).toHaveLength(5)
    expect(visible.secret).toBeUndefined()
  })

  test("author sees only unrestricted fields", () => {
    const visible = filterFieldsByRole(fields, "author")
    expect(Object.keys(visible)).toHaveLength(4)
    expect(visible.layout).toBeUndefined()
    expect(visible.customCSS).toBeUndefined()
  })

  test("returns all fields when no access rules defined", () => {
    const simple = { title: field.text({ required: true }), body: field.richText() }
    expect(Object.keys(filterFieldsByRole(simple, "author"))).toHaveLength(2)
  })
})
```

- [ ] **Create field-filter.ts**

```typescript
// packages/core/src/roles/field-filter.ts
import type { FieldDef } from "../types"

export function filterFieldsByRole(fields: Record<string, FieldDef>, role: string): Record<string, FieldDef> {
  const result: Record<string, FieldDef> = {}
  for (const [name, fieldDef] of Object.entries(fields)) {
    if (fieldDef.access?.read && !fieldDef.access.read.includes(role)) continue
    if (fieldDef.access?.write && !fieldDef.access.write.includes(role)) continue
    result[name] = fieldDef
  }
  return result
}
```

- [ ] **Run tests, export, commit**

Run: `cd packages/core && bun test test/roles/field-filter.test.ts`

```bash
git add packages/core/src/roles/ packages/core/test/roles/ packages/core/src/index.ts
git commit -m "feat(core): add role-based field visibility filter"
```

### Step 2: Wire into schema API

- [ ] **Modify schema handler** to accept `?role=` param and filter fields

```bash
git add packages/server/src/schema/handler.ts
git commit -m "feat(server): filter schema fields by role in _schema endpoint"
```

---

## Task C6: Theme Customizer

**Files:**
- Create: `packages/core/src/settings/service.ts`
- Create: `packages/core/test/settings/service.test.ts`
- Modify: `packages/core/src/db/bootstrap.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/admin/src/components/ThemeCustomizer.tsx`
- Modify: `packages/server/src/rest/handler.ts` or create settings handler
- Modify: `packages/server/src/index.ts`

### Step 1: Bootstrap and implement settings service

- [ ] **Add _settings table to bootstrap.ts**

```typescript
  db.run(sql`${sql.raw(`CREATE TABLE IF NOT EXISTS _settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`)}`)
```

- [ ] **Create settings service with tests**

```typescript
// packages/core/src/settings/service.ts
import { sql } from "drizzle-orm"
import type { AppDatabase } from "../db/connection"

export function createSettingsService(db: AppDatabase) {
  function get(key: string): string | null {
    const rows = db.all(sql`SELECT value FROM _settings WHERE key = ${key}`) as any[]
    return rows[0]?.value ?? null
  }

  function getAll(prefix?: string): Record<string, string> {
    const rows = prefix
      ? db.all(sql`SELECT key, value FROM _settings WHERE key LIKE ${prefix + "%"}`) as any[]
      : db.all(sql`SELECT key, value FROM _settings`) as any[]
    const result: Record<string, string> = {}
    for (const row of rows) result[row.key] = row.value
    return result
  }

  function set(key: string, value: string): void {
    const now = new Date().toISOString()
    db.run(sql`INSERT INTO _settings (key, value, updated_at) VALUES (${key}, ${value}, ${now}) ON CONFLICT(key) DO UPDATE SET value = ${value}, updated_at = ${now}`)
  }

  function remove(key: string): void {
    db.run(sql`DELETE FROM _settings WHERE key = ${key}`)
  }

  return { get, getAll, set, remove }
}

export type SettingsService = ReturnType<typeof createSettingsService>
```

- [ ] **Export, test, commit**

```bash
git add packages/core/src/settings/ packages/core/test/settings/ packages/core/src/db/bootstrap.ts packages/core/src/index.ts
git commit -m "feat(core): add key-value settings service with DB persistence"
```

### Step 2: Create admin UI and wire server

- [ ] **Add settings REST routes, create ThemeCustomizer.tsx, wire into renderer**

```bash
git add packages/admin/ packages/server/ packages/renderer/
git commit -m "feat: add theme customizer with visual controls and live settings"
```

---

## Task C7: Email Channel Rendering

**Files:**
- Create: `packages/renderer/src/runtime/email-channel.ts`
- Create: `packages/renderer/test/runtime/email-channel.test.ts`
- Modify: `packages/renderer/package.json`

### Step 1: Install MJML and write tests

- [ ] **Install**: `cd packages/renderer && bun add mjml`

- [ ] **Create test file**

```typescript
// packages/renderer/test/runtime/email-channel.test.ts
import { test, expect, describe } from "bun:test"
import { portableTextToEmail } from "../../src/runtime/email-channel"

describe("portableTextToEmail", () => {
  test("renders paragraph to email HTML", () => {
    const blocks = [{ type: "paragraph", children: [{ type: "text", value: "Hello world" }] }]
    const html = portableTextToEmail(blocks)
    expect(html).toContain("Hello world")
    expect(html).toContain("<!doctype html>")
  })

  test("renders heading blocks", () => {
    const blocks = [{ type: "heading", level: 2, children: [{ type: "text", value: "My Heading" }] }]
    const html = portableTextToEmail(blocks)
    expect(html).toContain("My Heading")
  })

  test("renders bold and italic", () => {
    const blocks = [{ type: "paragraph", children: [{ type: "text", value: "bold", marks: ["bold"] }, { type: "text", value: " and " }, { type: "text", value: "italic", marks: ["italic"] }] }]
    const html = portableTextToEmail(blocks)
    expect(html).toContain("<b>bold</b>")
    expect(html).toContain("<i>italic</i>")
  })

  test("renders images", () => {
    const blocks = [{ type: "image", src: "https://example.com/photo.jpg", alt: "A photo" }]
    const html = portableTextToEmail(blocks)
    expect(html).toContain("https://example.com/photo.jpg")
  })

  test("wraps in template with title", () => {
    const blocks = [{ type: "paragraph", children: [{ type: "text", value: "Content" }] }]
    const html = portableTextToEmail(blocks, { title: "My Newsletter" })
    expect(html).toContain("My Newsletter")
  })
})
```

### Step 2: Implement email renderer

- [ ] **Create email-channel.ts** with MJML-based Portable Text renderer (see plan details above)

- [ ] **Run tests, commit**

```bash
git add packages/renderer/src/runtime/email-channel.ts packages/renderer/test/runtime/email-channel.test.ts packages/renderer/package.json
git commit -m "feat(renderer): add MJML-based email channel renderer for Portable Text"
```

---

## Task C8: WordPress Import

**Files:**
- Create: `packages/core/src/import/wordpress.ts`
- Create: `packages/core/test/import/wordpress.test.ts`
- Create: `packages/cli/src/commands/import.ts`
- Modify: `packages/cli/src/bin.ts`
- Modify: `packages/core/src/index.ts`

### Step 1: Write tests and implement parser

- [ ] **Create test file**

```typescript
// packages/core/test/import/wordpress.test.ts
import { test, expect, describe } from "bun:test"
import { parseWXR, htmlToPortableText } from "../../src/import/wordpress"

describe("WordPress import", () => {
  test("htmlToPortableText converts paragraph", () => {
    const blocks = htmlToPortableText("<p>Hello world</p>")
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe("paragraph")
    expect(blocks[0].children[0].value).toBe("Hello world")
  })

  test("htmlToPortableText converts heading", () => {
    const blocks = htmlToPortableText("<h2>My Heading</h2>")
    expect(blocks[0].type).toBe("heading")
    expect(blocks[0].level).toBe(2)
  })

  test("htmlToPortableText converts bold and italic", () => {
    const blocks = htmlToPortableText("<p><strong>bold</strong> and <em>italic</em></p>")
    expect(blocks[0].children[0].marks).toContain("bold")
    expect(blocks[0].children[2].marks).toContain("italic")
  })

  test("htmlToPortableText converts images", () => {
    const blocks = htmlToPortableText('<img src="https://example.com/img.jpg" alt="Photo" />')
    expect(blocks[0].type).toBe("image")
  })

  test("htmlToPortableText converts lists", () => {
    const blocks = htmlToPortableText("<ul><li>Item 1</li><li>Item 2</li></ul>")
    expect(blocks[0].type).toBe("bulletList")
    expect(blocks[0].items).toHaveLength(2)
  })

  test("parseWXR extracts posts from WXR", () => {
    const wxr = `<?xml version="1.0"?>
    <rss version="2.0" xmlns:wp="http://wordpress.org/export/1.2/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
      <channel>
        <item>
          <title>Test Post</title>
          <wp:post_name>test-post</wp:post_name>
          <wp:post_type>post</wp:post_type>
          <wp:status>publish</wp:status>
          <content:encoded><![CDATA[<p>Hello world</p>]]></content:encoded>
        </item>
      </channel>
    </rss>`
    const result = parseWXR(wxr)
    expect(result.posts).toHaveLength(1)
    expect(result.posts[0].title).toBe("Test Post")
    expect(result.posts[0].status).toBe("published")
    expect(result.posts[0].body[0].type).toBe("paragraph")
  })
})
```

- [ ] **Create wordpress.ts** with `htmlToPortableText` and `parseWXR` (see detailed implementation in plan)

- [ ] **Run tests, export, commit**

```bash
git add packages/core/src/import/ packages/core/test/import/ packages/core/src/index.ts
git commit -m "feat(core): add WordPress WXR parser with HTML-to-Portable-Text conversion"
```

### Step 2: Create CLI import command

- [ ] **Create import.ts** — `not-a-cms import wordpress <file>` reads WXR, parses, imports into collections
- [ ] **Register in bin.ts**: `import "./commands/import"`
- [ ] **Commit**

```bash
git add packages/cli/src/commands/import.ts packages/cli/src/bin.ts
git commit -m "feat(cli): add WordPress import command"
```

---

## Post-Implementation: Update MILESTONES.md

- [ ] **Mark all C1-C8 as done, update current state summary**

```bash
git add MILESTONES.md
git commit -m "docs: mark Phase C complete in milestones"
```
