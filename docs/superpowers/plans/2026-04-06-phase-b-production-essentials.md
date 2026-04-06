# Phase B: Production Essentials — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make not-a-cms reliable enough to run a real site — content versioning, full-text search, proper migrations, image optimization, error handling, a working public site renderer, RSS feed, and deployment config.

**Architecture:** Eight independent features that harden the CMS for production. Content versioning snapshots documents in a `_versions` table on every save/publish. Full-text search uses SQLite FTS5 with a unified index across all collections. Migrations replace `bootstrapTables()` with tracked SQL files. Image optimization runs uploads through `sharp` to generate responsive WebP/AVIF variants. Error boundaries and toast notifications polish the admin UI. The renderer fetches real content from the API and renders Portable Text through Astro block components. RSS serves published posts. Deployment packages everything in Docker.

**Tech Stack:** Bun, Drizzle ORM, SQLite FTS5, sharp, React 19, Astro, Docker

---

## Execution Waves

Tasks are grouped by dependency. All tasks within a wave can run in parallel.

```
Wave 1 (parallel):  B1 Content Versioning   │  B2 Full-Text Search   │  B5 Error Handling
Wave 2 (parallel):  B3 Migrations           │  B4 Image Optimization │  B6 Renderer
Wave 3 (sequential): B7 RSS Feed (needs B6) → B8 Deployment (last)
```

---

## File Structure (all changes)

```
packages/
├── core/src/
│   ├── content/
│   │   ├── versioning.ts               CREATE — version snapshot/restore service
│   │   ├── search.ts                   CREATE — FTS5 search service
│   │   └── service.ts                  MODIFY — call versioning on save, sync FTS
│   ├── db/
│   │   ├── bootstrap.ts                MODIFY — add _versions and FTS tables
│   │   ├── migrator.ts                 CREATE — migration runner + state tracking
│   │   └── schema-generator.ts         CREATE — generate SQL DDL from collections
│   └── index.ts                        MODIFY — export new modules
├── core/test/
│   ├── content/
│   │   ├── versioning.test.ts          CREATE
│   │   └── search.test.ts             CREATE
│   └── db/
│       └── migrator.test.ts            CREATE
├── server/src/
│   ├── rest/
│   │   └── handler.ts                  MODIFY — version + search endpoints, better errors
│   ├── media/
│   │   ├── optimizer.ts                CREATE — sharp image processing pipeline
│   │   ├── storage.ts                  MODIFY — persist to DB, store variants
│   │   └── handler.ts                  MODIFY — serve optimized variants
│   └── index.ts                        MODIFY — wire versioning, pass optimizer
├── server/test/
│   └── media/
│       └── optimizer.test.ts           CREATE
├── admin/src/
│   ├── components/
│   │   ├── ErrorBoundary.tsx           CREATE — React error boundary
│   │   ├── Toast.tsx                   CREATE — toast notification system
│   │   ├── LoadingSkeleton.tsx         CREATE — content list/editor skeletons
│   │   ├── VersionHistory.tsx          CREATE — version list + restore UI
│   │   ├── SearchBar.tsx               CREATE — debounced search input
│   │   ├── ContentList.tsx             MODIFY — add search, skeleton, error boundary
│   │   └── ContentEditor.tsx           MODIFY — add version history, toasts, error boundary
├── renderer/src/
│   ├── runtime/
│   │   └── content-fetcher.ts          MODIFY — fix getBySlug, add search/where support
│   ├── pages/
│   │   ├── index.astro                 MODIFY — list published posts
│   │   ├── [...slug].astro             MODIFY — fetch + render real content
│   │   └── rss.xml.ts                  MODIFY — fetch real published posts
│   └── defaults/
│       └── components/
│           └── Image.astro             MODIFY — srcset + picture tag for variants
├── cli/src/
│   └── commands/
│       ├── generate.ts                 MODIFY — wire real migration generation
│       └── migrate.ts                  MODIFY — wire real migration runner
├── scripts/
│   └── dev.ts                          MODIFY — boot renderer alongside admin + API
├── Dockerfile                          CREATE
├── docker-compose.yml                  CREATE
└── fly.toml                            CREATE
```

---

## Task B1: Content Versioning

**Files:**
- Create: `packages/core/src/content/versioning.ts`
- Create: `packages/core/test/content/versioning.test.ts`
- Modify: `packages/core/src/db/bootstrap.ts`
- Modify: `packages/core/src/content/service.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/server/src/rest/handler.ts`
- Modify: `packages/server/src/index.ts`
- Create: `packages/admin/src/components/VersionHistory.tsx`
- Modify: `packages/admin/src/components/ContentEditor.tsx`

### Step 1: Write failing tests for versioning service

- [ ] **Create test file**

```typescript
// packages/core/test/content/versioning.test.ts
import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { unlinkSync } from "node:fs"
import { createDatabase } from "../../src/db/connection"
import { bootstrapTables } from "../../src/db/bootstrap"
import { defineCollection } from "../../src/schema/collection"
import { field } from "../../src/schema/field"
import { generateTable } from "../../src/db/generate-table"
import { createContentService } from "../../src/content/service"
import { createVersioningService } from "../../src/content/versioning"

const testDbPath = "test-versioning.db"

const blogPost = defineCollection({
  name: "blog_post",
  labels: { singular: "Blog Post", plural: "Blog Posts" },
  fields: {
    title: field.text({ required: true }),
    slug: field.slug({ from: "title" }),
    body: field.richText(),
    status: field.select(["draft", "published"], { default: "draft" }),
  },
})

let db: ReturnType<typeof createDatabase>
let service: ReturnType<typeof createContentService>
let versioning: ReturnType<typeof createVersioningService>

describe("createVersioningService", () => {
  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [blogPost])
    const table = generateTable(blogPost)
    service = createContentService(db, blogPost, table)
    versioning = createVersioningService(db)
  })

  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("createVersion() snapshots a document", async () => {
    const doc = await service.create({ title: "Hello", status: "draft" })
    const version = versioning.createVersion("blog_post", doc.id as string, doc, "save")
    expect(version.id).toBeDefined()
    expect(version.collection).toBe("blog_post")
    expect(version.document_id).toBe(doc.id)
    expect(version.version_number).toBe(1)
    expect(version.action).toBe("save")
  })

  test("createVersion() increments version_number", async () => {
    const doc = await service.create({ title: "Hello", status: "draft" })
    versioning.createVersion("blog_post", doc.id as string, doc, "save")
    const v2 = versioning.createVersion("blog_post", doc.id as string, { ...doc, title: "Updated" }, "save")
    expect(v2.version_number).toBe(2)
  })

  test("listVersions() returns versions newest-first", async () => {
    const doc = await service.create({ title: "v1", status: "draft" })
    versioning.createVersion("blog_post", doc.id as string, doc, "save")
    versioning.createVersion("blog_post", doc.id as string, { ...doc, title: "v2" }, "save")
    versioning.createVersion("blog_post", doc.id as string, { ...doc, title: "v3" }, "publish")

    const versions = versioning.listVersions("blog_post", doc.id as string)
    expect(versions).toHaveLength(3)
    expect(versions[0].version_number).toBe(3)
    expect(versions[0].action).toBe("publish")
  })

  test("getVersion() returns a specific version", async () => {
    const doc = await service.create({ title: "Original", status: "draft" })
    const v1 = versioning.createVersion("blog_post", doc.id as string, doc, "save")

    const retrieved = versioning.getVersion(v1.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.data.title).toBe("Original")
  })

  test("getVersion() returns null for non-existent", () => {
    const result = versioning.getVersion("non-existent")
    expect(result).toBeNull()
  })

  test("version data is a full snapshot of the document", async () => {
    const doc = await service.create({ title: "Hello", body: '[]', status: "draft" })
    versioning.createVersion("blog_post", doc.id as string, doc, "save")

    await service.update(doc.id as string, { title: "Changed" })
    versioning.createVersion("blog_post", doc.id as string, { ...doc, title: "Changed" }, "save")

    const versions = versioning.listVersions("blog_post", doc.id as string)
    expect(versions[0].data.title).toBe("Changed")
    expect(versions[1].data.title).toBe("Hello")
  })
})
```

- [ ] **Run test to verify it fails**

Run: `cd packages/core && bun test test/content/versioning.test.ts`
Expected: FAIL — `createVersioningService` not found

### Step 2: Bootstrap the _versions table

- [ ] **Modify bootstrap.ts to create _versions table**

Add to `packages/core/src/db/bootstrap.ts`, after the collection table creation loop:

```typescript
// Add after the for loop in bootstrapTables():
  db.run(sql`${sql.raw(`CREATE TABLE IF NOT EXISTS _versions (
    id TEXT PRIMARY KEY,
    collection TEXT NOT NULL,
    document_id TEXT NOT NULL,
    data TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    action TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`)}`)

  db.run(sql`${sql.raw(
    `CREATE INDEX IF NOT EXISTS idx_versions_lookup ON _versions(collection, document_id, version_number DESC)`
  )}`)
```

### Step 3: Implement versioning service

- [ ] **Create versioning.ts**

```typescript
// packages/core/src/content/versioning.ts
import { sql } from "drizzle-orm"
import type { AppDatabase } from "../db/connection"

type VersionRecord = {
  id: string
  collection: string
  document_id: string
  data: Record<string, unknown>
  version_number: number
  action: "save" | "publish"
  created_at: string
}

type VersionRow = Omit<VersionRecord, "data"> & { data: string }

export function createVersioningService(db: AppDatabase) {
  function createVersion(
    collection: string,
    documentId: string,
    data: Record<string, unknown>,
    action: "save" | "publish",
  ): VersionRecord {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    // Get next version number
    const rows = db.all<{ max_v: number | null }>(
      sql`SELECT MAX(version_number) as max_v FROM _versions WHERE collection = ${collection} AND document_id = ${documentId}`,
    )
    const maxV = (rows[0] as any)?.max_v ?? 0
    const versionNumber = maxV + 1

    const dataJson = JSON.stringify(data)

    db.run(
      sql`INSERT INTO _versions (id, collection, document_id, data, version_number, action, created_at) VALUES (${id}, ${collection}, ${documentId}, ${dataJson}, ${versionNumber}, ${action}, ${now})`,
    )

    return { id, collection, document_id: documentId, data, version_number: versionNumber, action, created_at: now }
  }

  function listVersions(collection: string, documentId: string): VersionRecord[] {
    const rows = db.all<VersionRow>(
      sql`SELECT * FROM _versions WHERE collection = ${collection} AND document_id = ${documentId} ORDER BY version_number DESC`,
    )
    return (rows as any[]).map(parseVersionRow)
  }

  function getVersion(versionId: string): VersionRecord | null {
    const rows = db.all<VersionRow>(
      sql`SELECT * FROM _versions WHERE id = ${versionId}`,
    )
    const row = (rows as any[])[0]
    if (!row) return null
    return parseVersionRow(row)
  }

  return { createVersion, listVersions, getVersion }
}

function parseVersionRow(row: any): VersionRecord {
  return {
    ...row,
    data: typeof row.data === "string" ? JSON.parse(row.data) : row.data,
  }
}

export type VersioningService = ReturnType<typeof createVersioningService>
export type { VersionRecord }
```

- [ ] **Run tests to verify they pass**

Run: `cd packages/core && bun test test/content/versioning.test.ts`
Expected: All 6 tests PASS

- [ ] **Commit**

```bash
git add packages/core/src/content/versioning.ts packages/core/test/content/versioning.test.ts packages/core/src/db/bootstrap.ts
git commit -m "feat(core): add content versioning service with snapshot/list/restore"
```

### Step 4: Wire versioning into content service

- [ ] **Modify content service to snapshot on create and update**

In `packages/core/src/content/service.ts`, add versioning parameter and calls:

Change the function signature:
```typescript
export function createContentService(
  db: AppDatabase,
  collection: CollectionDef,
  table: AnyTable,
  versioning?: { createVersion: (collection: string, docId: string, data: Record<string, unknown>, action: "save" | "publish") => unknown },
) {
```

In `create()`, after `saved = await runHook("afterSave", ...)`, add:
```typescript
    if (versioning) {
      versioning.createVersion(collection.name, id, saved, "save")
    }
```

In `update()`, after `updated = await runHook("afterSave", ...)`, add:
```typescript
    const action = doc.status === "published" ? "publish" : "save"
    if (versioning) {
      versioning.createVersion(collection.name, id, updated, action as "save" | "publish")
    }
```

- [ ] **Run existing content service tests to verify nothing broke**

Run: `cd packages/core && bun test test/content/service.test.ts`
Expected: All tests PASS (versioning is optional, so existing tests keep working)

- [ ] **Commit**

```bash
git add packages/core/src/content/service.ts
git commit -m "feat(core): snapshot versions on content create and update"
```

### Step 5: Export versioning from core and wire into server

- [ ] **Add exports to core/src/index.ts**

Add these lines:
```typescript
// Versioning
export { createVersioningService, type VersioningService, type VersionRecord } from "./content/versioning"
```

- [ ] **Wire versioning in server/src/index.ts**

Add import:
```typescript
import { createVersioningService } from "@not-a-cms/core"
```

After `bootstrapTables(db, config.collections)`, add:
```typescript
  const versioning = createVersioningService(db)
```

Change the service creation in the collection loop:
```typescript
    const service = createContentService(db, def, table, versioning)
```

Add `versioning` to the return object:
```typescript
  return { server, db, collections, trpcRouter, versioning }
```

- [ ] **Commit**

```bash
git add packages/core/src/index.ts packages/server/src/index.ts
git commit -m "feat(server): wire versioning service into server startup"
```

### Step 6: Add version REST endpoints

- [ ] **Add version routes to REST handler**

In `packages/server/src/rest/handler.ts`, the handler function needs to accept `versioning` and handle version routes. Update the factory function signature:

```typescript
export function createRestHandler(
  collections: Map<string, CollectionEntry>,
  versioning?: { createVersion: Function; listVersions: Function; getVersion: Function },
) {
```

Inside the handler function, before the collection-level routes block, add version route handling:

```typescript
      // Version routes: /api/:collection/:id/versions
      if (segments.length === 3 && segments[2] === "versions" && versioning) {
        const docId = segments[1]
        if (method === "GET") {
          const versions = versioning.listVersions(collectionName, docId)
          return json({ data: versions })
        }
        return json({ error: "Method not allowed" }, 405)
      }

      // Single version: /api/:collection/:id/versions/:versionId
      if (segments.length === 4 && segments[2] === "versions" && versioning) {
        const versionId = segments[3]
        if (method === "GET") {
          const version = versioning.getVersion(versionId)
          if (!version) return json({ error: "Version not found" }, 404)
          return json(version)
        }
        return json({ error: "Method not allowed" }, 405)
      }
```

In `packages/server/src/index.ts`, update the `createRestHandler` call:
```typescript
  const restHandler = createRestHandler(collections, versioning)
```

- [ ] **Run existing REST handler tests**

Run: `cd packages/server && bun test test/rest/handler.test.ts`
Expected: PASS

- [ ] **Commit**

```bash
git add packages/server/src/rest/handler.ts packages/server/src/index.ts
git commit -m "feat(server): add REST endpoints for content version history"
```

### Step 7: Add VersionHistory component to admin

- [ ] **Create VersionHistory.tsx**

```typescript
// packages/admin/src/components/VersionHistory.tsx
import { useState, useEffect } from "react"

type Version = {
  id: string
  version_number: number
  action: "save" | "publish"
  created_at: string
  data: Record<string, unknown>
}

type Props = {
  collection: string
  documentId: string
  apiBase?: string
  onRestore: (data: Record<string, unknown>) => void
}

export function VersionHistory({ collection, documentId, apiBase = "", onRestore }: Props) {
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!documentId) return
    setLoading(true)
    fetch(`${apiBase}/api/${collection}/${documentId}/versions`)
      .then((res) => res.ok ? res.json() : { data: [] })
      .then((res) => setVersions(res.data || []))
      .catch(() => setVersions([]))
      .finally(() => setLoading(false))
  }, [collection, documentId, apiBase])

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    })

  if (loading) {
    return <p className="text-xs text-gray-400 py-2">Loading history...</p>
  }

  if (versions.length === 0) {
    return <p className="text-xs text-gray-400 py-2">No version history yet</p>
  }

  return (
    <div className="space-y-1">
      {versions.map((v) => (
        <div key={v.id} className="border border-gray-100 rounded-lg">
          <button
            onClick={() => setExpanded(expanded === v.id ? null : v.id)}
            className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 rounded-lg transition-colors"
          >
            <div>
              <span className="text-xs font-medium text-gray-700">v{v.version_number}</span>
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                v.action === "publish" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
              }`}>
                {v.action}
              </span>
            </div>
            <span className="text-xs text-gray-400">{formatDate(v.created_at)}</span>
          </button>
          {expanded === v.id && (
            <div className="px-3 pb-2 border-t border-gray-100">
              <button
                onClick={() => {
                  if (confirm("Restore this version? Current unsaved changes will be lost.")) {
                    onRestore(v.data)
                  }
                }}
                className="mt-2 w-full py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Restore this version
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Wire VersionHistory into ContentEditor.tsx**

In `packages/admin/src/components/ContentEditor.tsx`:

Add import at the top:
```typescript
import { VersionHistory } from "./VersionHistory"
```

Add `onRestore` handler inside the `ContentEditor` component, after the `handleSave` function:
```typescript
  const handleRestore = (versionData: Record<string, unknown>) => {
    setData(versionData)
    setSaved(false)
  }
```

Add the VersionHistory panel in the sidebar `<div className="w-72 space-y-6">`, after the existing "Details" card:
```typescript
        {documentId && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <h3 className="font-medium text-sm text-gray-900">Version History</h3>
            <VersionHistory
              collection={collection}
              documentId={documentId}
              apiBase={apiBase}
              onRestore={handleRestore}
            />
          </div>
        )}
```

- [ ] **Commit**

```bash
git add packages/admin/src/components/VersionHistory.tsx packages/admin/src/components/ContentEditor.tsx
git commit -m "feat(admin): add version history sidebar with restore in content editor"
```

---

## Task B2: Full-Text Search

**Files:**
- Create: `packages/core/src/content/search.ts`
- Create: `packages/core/test/content/search.test.ts`
- Modify: `packages/core/src/db/bootstrap.ts`
- Modify: `packages/core/src/content/service.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/server/src/rest/handler.ts`
- Modify: `packages/server/src/index.ts`
- Create: `packages/admin/src/components/SearchBar.tsx`
- Modify: `packages/admin/src/components/ContentList.tsx`

### Step 1: Write failing tests for search service

- [ ] **Create test file**

```typescript
// packages/core/test/content/search.test.ts
import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { unlinkSync } from "node:fs"
import { createDatabase } from "../../src/db/connection"
import { bootstrapTables } from "../../src/db/bootstrap"
import { defineCollection } from "../../src/schema/collection"
import { field } from "../../src/schema/field"
import { createSearchService } from "../../src/content/search"

const testDbPath = "test-search.db"

const blogPost = defineCollection({
  name: "blog_post",
  labels: { singular: "Blog Post", plural: "Blog Posts" },
  fields: {
    title: field.text({ required: true }),
    body: field.richText(),
    status: field.select(["draft", "published"], { default: "draft" }),
  },
})

let db: ReturnType<typeof createDatabase>
let search: ReturnType<typeof createSearchService>

describe("createSearchService", () => {
  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    bootstrapTables(db, [blogPost])
    search = createSearchService(db)
  })

  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("index() adds a document to the search index", () => {
    search.index("blog_post", "doc-1", "Hello World", "This is the body text")
    const results = search.query("Hello")
    expect(results).toHaveLength(1)
    expect(results[0].document_id).toBe("doc-1")
    expect(results[0].collection).toBe("blog_post")
  })

  test("query() returns empty array for no matches", () => {
    search.index("blog_post", "doc-1", "Hello World", "Body")
    const results = search.query("nonexistent")
    expect(results).toHaveLength(0)
  })

  test("query() matches partial words with prefix search", () => {
    search.index("blog_post", "doc-1", "Authentication Guide", "How to set up auth")
    const results = search.query("auth")
    expect(results).toHaveLength(1)
  })

  test("query() searches across title and body", () => {
    search.index("blog_post", "doc-1", "Title One", "unique-body-keyword")
    const results = search.query("unique-body-keyword")
    expect(results).toHaveLength(1)
  })

  test("query() can filter by collection", () => {
    search.index("blog_post", "doc-1", "Blog Title", "body")
    search.index("page", "doc-2", "Page Title", "body")
    const results = search.query("Title", "blog_post")
    expect(results).toHaveLength(1)
    expect(results[0].collection).toBe("blog_post")
  })

  test("update() replaces an existing index entry", () => {
    search.index("blog_post", "doc-1", "Old Title", "old body")
    search.update("blog_post", "doc-1", "New Title", "new body")
    const oldResults = search.query("Old")
    expect(oldResults).toHaveLength(0)
    const newResults = search.query("New")
    expect(newResults).toHaveLength(1)
  })

  test("remove() deletes from the index", () => {
    search.index("blog_post", "doc-1", "Hello World", "body")
    search.remove("blog_post", "doc-1")
    const results = search.query("Hello")
    expect(results).toHaveLength(0)
  })
})
```

- [ ] **Run test to verify it fails**

Run: `cd packages/core && bun test test/content/search.test.ts`
Expected: FAIL — `createSearchService` not found

### Step 2: Bootstrap the FTS5 table

- [ ] **Add FTS5 table creation to bootstrap.ts**

Add after the `_versions` table creation in `packages/core/src/db/bootstrap.ts`:

```typescript
  db.run(sql`${sql.raw(`CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
    collection,
    document_id,
    title,
    body_text,
    tokenize='porter unicode61'
  )`)}`)
```

### Step 3: Implement search service

- [ ] **Create search.ts**

```typescript
// packages/core/src/content/search.ts
import { sql } from "drizzle-orm"
import type { AppDatabase } from "../db/connection"

type SearchResult = {
  collection: string
  document_id: string
  rank: number
}

export function createSearchService(db: AppDatabase) {
  function index(collection: string, documentId: string, title: string, bodyText: string) {
    // Remove any existing entry first
    db.run(
      sql`DELETE FROM content_fts WHERE collection = ${collection} AND document_id = ${documentId}`,
    )
    db.run(
      sql`INSERT INTO content_fts (collection, document_id, title, body_text) VALUES (${collection}, ${documentId}, ${title}, ${bodyText})`,
    )
  }

  function update(collection: string, documentId: string, title: string, bodyText: string) {
    index(collection, documentId, title, bodyText)
  }

  function remove(collection: string, documentId: string) {
    db.run(
      sql`DELETE FROM content_fts WHERE collection = ${collection} AND document_id = ${documentId}`,
    )
  }

  function query(searchTerm: string, collection?: string): SearchResult[] {
    // Append * for prefix matching so "auth" matches "authentication"
    const ftsQuery = searchTerm.trim().split(/\s+/).map(t => `"${t}"*`).join(" ")

    let sqlQuery
    if (collection) {
      sqlQuery = sql`SELECT collection, document_id, rank FROM content_fts WHERE content_fts MATCH ${ftsQuery} AND collection = ${collection} ORDER BY rank LIMIT 50`
    } else {
      sqlQuery = sql`SELECT collection, document_id, rank FROM content_fts WHERE content_fts MATCH ${ftsQuery} ORDER BY rank LIMIT 50`
    }

    const rows = db.all<SearchResult>(sqlQuery)
    return rows as SearchResult[]
  }

  return { index, update, remove, query }
}

export type SearchService = ReturnType<typeof createSearchService>
export type { SearchResult }
```

- [ ] **Run tests to verify they pass**

Run: `cd packages/core && bun test test/content/search.test.ts`
Expected: All 7 tests PASS

- [ ] **Commit**

```bash
git add packages/core/src/content/search.ts packages/core/test/content/search.test.ts packages/core/src/db/bootstrap.ts
git commit -m "feat(core): add FTS5-powered full-text search service"
```

### Step 4: Extract text from Portable Text for indexing

The `body` field stores Portable Text JSON. We need to extract plain text for the FTS index.

- [ ] **Add extractText helper to search.ts**

Add at the bottom of `packages/core/src/content/search.ts`:

```typescript
/**
 * Extract plain text from Portable Text JSON for FTS indexing.
 * Walks the block tree and concatenates all text node values.
 */
export function extractTextFromPortableText(blocks: unknown): string {
  if (!blocks) return ""
  if (typeof blocks === "string") {
    try {
      blocks = JSON.parse(blocks)
    } catch {
      return blocks
    }
  }
  if (!Array.isArray(blocks)) return ""

  const parts: string[] = []
  function walk(node: any) {
    if (!node) return
    if (typeof node === "string") { parts.push(node); return }
    if (node.value && typeof node.value === "string") parts.push(node.value)
    if (node.text && typeof node.text === "string") parts.push(node.text)
    if (Array.isArray(node.children)) node.children.forEach(walk)
    if (Array.isArray(node.items)) node.items.forEach((item: any) => {
      if (Array.isArray(item)) item.forEach(walk)
      else walk(item)
    })
  }
  for (const block of blocks) walk(block)
  return parts.join(" ")
}
```

### Step 5: Sync FTS on content create/update/delete

- [ ] **Modify content service to sync FTS**

In `packages/core/src/content/service.ts`, add optional `search` parameter:

Update the function signature:
```typescript
export function createContentService(
  db: AppDatabase,
  collection: CollectionDef,
  table: AnyTable,
  versioning?: { createVersion: (collection: string, docId: string, data: Record<string, unknown>, action: "save" | "publish") => unknown },
  search?: { index: (collection: string, docId: string, title: string, bodyText: string) => void; remove: (collection: string, docId: string) => void },
) {
```

In `create()`, after the versioning call, add:
```typescript
    if (search) {
      const { extractTextFromPortableText } = require("./search")
      search.index(collection.name, id, String(saved.title ?? ""), extractTextFromPortableText(saved.body))
    }
```

Actually, since this is ESM, use a sync import at the top instead:
Add at the top of service.ts:
```typescript
import { extractTextFromPortableText } from "./search"
```

Then in `create()`, after versioning:
```typescript
    if (search) {
      search.index(collection.name, id, String(saved.title ?? ""), extractTextFromPortableText(saved.body))
    }
```

In `update()`, after versioning:
```typescript
    if (search) {
      search.index(collection.name, id, String(updated.title ?? ""), extractTextFromPortableText(updated.body))
    }
```

In `remove()`, before `db.delete(table)`:
```typescript
    if (search) {
      search.remove(collection.name, id)
    }
```

- [ ] **Run all core tests**

Run: `cd packages/core && bun test`
Expected: All tests PASS

- [ ] **Commit**

```bash
git add packages/core/src/content/service.ts packages/core/src/content/search.ts
git commit -m "feat(core): sync FTS index on content create, update, and delete"
```

### Step 6: Export search from core, wire into server

- [ ] **Add exports to core/src/index.ts**

```typescript
// Search
export { createSearchService, extractTextFromPortableText, type SearchService, type SearchResult } from "./content/search"
```

- [ ] **Wire search in server/src/index.ts**

Add import:
```typescript
import { createSearchService } from "@not-a-cms/core"
```

After the versioning creation:
```typescript
  const search = createSearchService(db)
```

Update service creation:
```typescript
    const service = createContentService(db, def, table, versioning, search)
```

Update the rest handler call:
```typescript
  const restHandler = createRestHandler(collections, versioning, search)
```

Add `search` to return:
```typescript
  return { server, db, collections, trpcRouter, versioning, search }
```

### Step 7: Add ?search= support to REST handler

- [ ] **Update REST handler signature and add search routing**

In `packages/server/src/rest/handler.ts`, update the signature:
```typescript
export function createRestHandler(
  collections: Map<string, CollectionEntry>,
  versioning?: { createVersion: Function; listVersions: Function; getVersion: Function },
  search?: { query: (term: string, collection?: string) => Array<{ collection: string; document_id: string }> },
) {
```

In the GET list handler (where `id === null` and `method === "GET"`), add search support before the existing `findMany` call:

```typescript
        if (method === "GET") {
          // Full-text search
          const searchTerm = url.searchParams.get("search")
          if (searchTerm && search) {
            const hits = search.query(searchTerm, collectionName)
            const docs = await Promise.all(
              hits.map((hit) => service.findById(hit.document_id)),
            )
            return json({ data: docs.filter(Boolean) })
          }

          // Regular list
          const limit = url.searchParams.has("limit")
          // ... rest unchanged
```

- [ ] **Commit**

```bash
git add packages/core/src/index.ts packages/server/src/index.ts packages/server/src/rest/handler.ts
git commit -m "feat(server): add ?search= query param to REST API with FTS5"
```

### Step 8: Add SearchBar component and wire into ContentList

- [ ] **Create SearchBar.tsx**

```typescript
// packages/admin/src/components/SearchBar.tsx
import { useState, useEffect, useRef } from "react"

type Props = {
  onSearch: (term: string) => void
  placeholder?: string
}

export function SearchBar({ onSearch, placeholder = "Search..." }: Props) {
  const [value, setValue] = useState("")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onSearch(value)
    }, 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [value])

  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {value && (
        <button
          onClick={() => { setValue(""); onSearch("") }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
```

- [ ] **Integrate SearchBar into ContentList.tsx**

In `packages/admin/src/components/ContentList.tsx`:

Add import:
```typescript
import { SearchBar } from "./SearchBar"
```

Add search state after the existing `useState` calls:
```typescript
  const [searchTerm, setSearchTerm] = useState("")
```

Modify `fetchItems` to accept an optional search parameter:
```typescript
  const fetchItems = async (search?: string) => {
    setLoading(true)
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : ""
      const res = await fetch(`${apiBase}/api/${collection}${params}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setItems(data.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
```

Update the `useEffect` to pass searchTerm:
```typescript
  useEffect(() => {
    fetchItems(searchTerm || undefined)
  }, [collection, searchTerm])
```

Add the search handler:
```typescript
  const handleSearch = (term: string) => {
    setSearchTerm(term)
  }
```

Add the SearchBar just before the table, inside the return. Before the opening `<div className="bg-white rounded-xl ...">`:
```typescript
      <div className="mb-4">
        <SearchBar onSearch={handleSearch} placeholder={`Search ${collectionLabel.toLowerCase()}...`} />
      </div>
```

Wrap the whole return in a fragment `<>...</>` so we can return the SearchBar + table together.

- [ ] **Commit**

```bash
git add packages/admin/src/components/SearchBar.tsx packages/admin/src/components/ContentList.tsx
git commit -m "feat(admin): add search bar with debounced FTS filtering to content list"
```

---

## Task B3: Drizzle Kit Migrations

**Files:**
- Create: `packages/core/src/db/migrator.ts`
- Create: `packages/core/src/db/schema-generator.ts`
- Create: `packages/core/test/db/migrator.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/cli/src/commands/generate.ts`
- Modify: `packages/cli/src/commands/migrate.ts`

### Step 1: Write failing tests for migrator

- [ ] **Create test file**

```typescript
// packages/core/test/db/migrator.test.ts
import { test, expect, describe, beforeEach, afterEach } from "bun:test"
import { unlinkSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { createDatabase } from "../../src/db/connection"
import { createMigrator } from "../../src/db/migrator"
import { sql } from "drizzle-orm"

const testDbPath = "test-migrator.db"
const testMigrationsDir = "test-migrations"

let db: ReturnType<typeof createDatabase>

describe("createMigrator", () => {
  beforeEach(() => {
    db = createDatabase({ url: testDbPath })
    mkdirSync(testMigrationsDir, { recursive: true })
  })

  afterEach(() => {
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
    try { rmSync(testMigrationsDir, { recursive: true }) } catch {}
  })

  test("creates _migrations table on init", () => {
    const migrator = createMigrator(db, testMigrationsDir)
    migrator.init()
    const rows = db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'`)
    expect((rows as any[]).length).toBe(1)
  })

  test("status() returns empty for no migrations", () => {
    const migrator = createMigrator(db, testMigrationsDir)
    migrator.init()
    const status = migrator.status()
    expect(status.applied).toHaveLength(0)
    expect(status.pending).toHaveLength(0)
  })

  test("status() shows pending migrations", () => {
    writeFileSync(join(testMigrationsDir, "001_init.sql"), "CREATE TABLE test1 (id TEXT);")
    const migrator = createMigrator(db, testMigrationsDir)
    migrator.init()
    const status = migrator.status()
    expect(status.pending).toHaveLength(1)
    expect(status.pending[0]).toBe("001_init.sql")
  })

  test("run() applies pending migrations", () => {
    writeFileSync(join(testMigrationsDir, "001_init.sql"), "CREATE TABLE test_table (id TEXT PRIMARY KEY, name TEXT);")
    const migrator = createMigrator(db, testMigrationsDir)
    migrator.init()

    const result = migrator.run()
    expect(result.applied).toHaveLength(1)
    expect(result.applied[0]).toBe("001_init.sql")

    // Verify table was created
    const rows = db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'`)
    expect((rows as any[]).length).toBe(1)
  })

  test("run() skips already-applied migrations", () => {
    writeFileSync(join(testMigrationsDir, "001_init.sql"), "CREATE TABLE test_table (id TEXT);")
    const migrator = createMigrator(db, testMigrationsDir)
    migrator.init()

    migrator.run()
    const result2 = migrator.run()
    expect(result2.applied).toHaveLength(0)
  })

  test("run() applies migrations in filename order", () => {
    writeFileSync(join(testMigrationsDir, "002_second.sql"), "CREATE TABLE t2 (id TEXT);")
    writeFileSync(join(testMigrationsDir, "001_first.sql"), "CREATE TABLE t1 (id TEXT);")
    const migrator = createMigrator(db, testMigrationsDir)
    migrator.init()

    const result = migrator.run()
    expect(result.applied).toEqual(["001_first.sql", "002_second.sql"])
  })

  test("status() shows applied and pending correctly", () => {
    writeFileSync(join(testMigrationsDir, "001_init.sql"), "CREATE TABLE t1 (id TEXT);")
    writeFileSync(join(testMigrationsDir, "002_add_col.sql"), "ALTER TABLE t1 ADD COLUMN name TEXT;")
    const migrator = createMigrator(db, testMigrationsDir)
    migrator.init()

    migrator.run() // apply both
    writeFileSync(join(testMigrationsDir, "003_new.sql"), "CREATE TABLE t2 (id TEXT);")

    const status = migrator.status()
    expect(status.applied).toHaveLength(2)
    expect(status.pending).toHaveLength(1)
    expect(status.pending[0]).toBe("003_new.sql")
  })
})
```

- [ ] **Run test to verify it fails**

Run: `cd packages/core && bun test test/db/migrator.test.ts`
Expected: FAIL — `createMigrator` not found

### Step 2: Implement migrator

- [ ] **Create migrator.ts**

```typescript
// packages/core/src/db/migrator.ts
import { sql } from "drizzle-orm"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { AppDatabase } from "./connection"

type MigrationStatus = {
  applied: string[]
  pending: string[]
}

type RunResult = {
  applied: string[]
}

export function createMigrator(db: AppDatabase, migrationsDir: string) {
  function init() {
    db.run(sql`${sql.raw(`CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    )`)}`)
  }

  function getApplied(): string[] {
    const rows = db.all<{ name: string }>(
      sql`SELECT name FROM _migrations ORDER BY id ASC`,
    )
    return (rows as any[]).map((r) => r.name)
  }

  function getPending(): string[] {
    const applied = new Set(getApplied())
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
    return files.filter((f) => !applied.has(f))
  }

  function status(): MigrationStatus {
    return {
      applied: getApplied(),
      pending: getPending(),
    }
  }

  function run(): RunResult {
    const pending = getPending()
    const applied: string[] = []

    for (const filename of pending) {
      const filePath = join(migrationsDir, filename)
      const sqlContent = readFileSync(filePath, "utf-8").trim()

      if (sqlContent) {
        // Split on semicolons for multi-statement migrations
        const statements = sqlContent
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean)

        for (const stmt of statements) {
          db.run(sql`${sql.raw(stmt)}`)
        }
      }

      const now = new Date().toISOString()
      db.run(
        sql`INSERT INTO _migrations (name, applied_at) VALUES (${filename}, ${now})`,
      )
      applied.push(filename)
    }

    return { applied }
  }

  return { init, status, run }
}

export type Migrator = ReturnType<typeof createMigrator>
```

- [ ] **Run tests to verify they pass**

Run: `cd packages/core && bun test test/db/migrator.test.ts`
Expected: All 6 tests PASS

- [ ] **Commit**

```bash
git add packages/core/src/db/migrator.ts packages/core/test/db/migrator.test.ts
git commit -m "feat(core): add SQL migration runner with state tracking"
```

### Step 3: Create schema-to-SQL generator

- [ ] **Create schema-generator.ts**

This generates the `CREATE TABLE` SQL for a set of collections, used by `not-a-cms generate migration`.

```typescript
// packages/core/src/db/schema-generator.ts
import type { CollectionDef } from "../types"

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

export function generateCreateTableSQL(collection: CollectionDef): string {
  const columns: string[] = [
    "id TEXT PRIMARY KEY",
    "created_at TEXT",
    "updated_at TEXT",
  ]

  for (const [name, fieldDef] of Object.entries(collection.fields)) {
    const colName = camelToSnake(name)
    const notNull = fieldDef.required ? " NOT NULL" : ""

    switch (fieldDef.type) {
      case "number":
      case "boolean":
        columns.push(`${colName} INTEGER${notNull}`)
        break
      case "relation":
      case "media":
        columns.push(`${colName}_id TEXT${notNull}`)
        break
      default:
        columns.push(`${colName} TEXT${notNull}`)
        break
    }
  }

  return `CREATE TABLE IF NOT EXISTS ${collection.name} (\n  ${columns.join(",\n  ")}\n);`
}

export function generateMigrationSQL(collections: CollectionDef[]): string {
  const parts: string[] = []

  for (const col of collections) {
    parts.push(generateCreateTableSQL(col))
  }

  // System tables
  parts.push(`CREATE TABLE IF NOT EXISTS _versions (
  id TEXT PRIMARY KEY,
  collection TEXT NOT NULL,
  document_id TEXT NOT NULL,
  data TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL
);`)

  parts.push(`CREATE INDEX IF NOT EXISTS idx_versions_lookup ON _versions(collection, document_id, version_number DESC);`)

  parts.push(`CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
  collection,
  document_id,
  title,
  body_text,
  tokenize='porter unicode61'
);`)

  return parts.join("\n\n")
}
```

- [ ] **Commit**

```bash
git add packages/core/src/db/schema-generator.ts
git commit -m "feat(core): add SQL DDL generator from collection definitions"
```

### Step 4: Export from core and wire CLI commands

- [ ] **Add exports to core/src/index.ts**

```typescript
// Migrations
export { createMigrator, type Migrator } from "./db/migrator"
export { generateMigrationSQL, generateCreateTableSQL } from "./db/schema-generator"
```

- [ ] **Rewrite cli/src/commands/generate.ts**

```typescript
// packages/cli/src/commands/generate.ts
import { registerCommand } from "../router"
import { existsSync, writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"

registerCommand({
  name: "generate",
  description: "Generate types and migrations",
  async run(args) {
    const subcommand = args[0]

    if (subcommand === "types") {
      console.log("Types are auto-generated from your schema at runtime.")
      console.log("No separate type generation step needed with TypeScript-first schemas.")
      return
    }

    if (subcommand === "migration") {
      const migrationName = args[1] || "schema"
      const configPath = join(process.cwd(), "not-a-cms.config.ts")

      if (!existsSync(configPath)) {
        console.error("No not-a-cms.config.ts found in current directory")
        process.exit(1)
      }

      try {
        const config = await import(configPath)
        const collections = config.default?.collections ?? []

        if (collections.length === 0) {
          console.error("No collections defined in config")
          process.exit(1)
        }

        const { generateMigrationSQL } = await import("@not-a-cms/core")
        const sql = generateMigrationSQL(collections)

        const migrationsDir = join(process.cwd(), "migrations")
        mkdirSync(migrationsDir, { recursive: true })

        const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)
        const filename = `${timestamp}_${migrationName}.sql`
        const filepath = join(migrationsDir, filename)

        writeFileSync(filepath, sql)
        console.log(`Created migration: migrations/${filename}`)
        console.log(`Run 'not-a-cms migrate' to apply it.`)
      } catch (err: any) {
        console.error("Failed to generate migration:", err.message)
        process.exit(1)
      }
      return
    }

    console.log(`
  Usage: not-a-cms generate <subcommand>

  Subcommands:
    types           Show schema type info (types are auto-generated at runtime)
    migration [name]  Generate a SQL migration from current schema
`)
  },
})
```

- [ ] **Rewrite cli/src/commands/migrate.ts**

```typescript
// packages/cli/src/commands/migrate.ts
import { registerCommand } from "../router"
import { existsSync } from "node:fs"
import { join } from "node:path"

registerCommand({
  name: "migrate",
  description: "Run database migrations",
  async run(args) {
    const subcommand = args[0] || "run"
    const configPath = join(process.cwd(), "not-a-cms.config.ts")

    if (!existsSync(configPath)) {
      console.error("No not-a-cms.config.ts found")
      process.exit(1)
    }

    const migrationsDir = join(process.cwd(), "migrations")
    if (!existsSync(migrationsDir)) {
      console.error("No migrations/ directory found. Run 'not-a-cms generate migration' first.")
      process.exit(1)
    }

    try {
      const config = await import(configPath)
      const dbUrl = config.default?.database?.url ?? "data.db"

      const { createDatabase, createMigrator } = await import("@not-a-cms/core")
      const db = createDatabase({ url: dbUrl })
      const migrator = createMigrator(db, migrationsDir)
      migrator.init()

      switch (subcommand) {
        case "run": {
          const status = migrator.status()
          if (status.pending.length === 0) {
            console.log("No pending migrations.")
            return
          }

          console.log(`Applying ${status.pending.length} migration(s)...`)
          const result = migrator.run()
          for (const name of result.applied) {
            console.log(`  Applied: ${name}`)
          }
          console.log("Done.")
          break
        }

        case "status": {
          const status = migrator.status()
          console.log(`Database: ${dbUrl}`)
          console.log(`Applied: ${status.applied.length}`)
          for (const name of status.applied) {
            console.log(`  [applied] ${name}`)
          }
          console.log(`Pending: ${status.pending.length}`)
          for (const name of status.pending) {
            console.log(`  [pending] ${name}`)
          }
          break
        }

        default:
          console.log(`
  Usage: not-a-cms migrate [subcommand]

  Subcommands:
    run         Apply pending migrations (default)
    status      Show migration status
`)
      }
    } catch (err: any) {
      console.error("Migration failed:", err.message)
      process.exit(1)
    }
  },
})
```

- [ ] **Commit**

```bash
git add packages/core/src/index.ts packages/cli/src/commands/generate.ts packages/cli/src/commands/migrate.ts
git commit -m "feat(cli): wire generate migration and migrate commands to real migrator"
```

---

## Task B4: Image Optimization

**Files:**
- Create: `packages/server/src/media/optimizer.ts`
- Create: `packages/server/test/media/optimizer.test.ts`
- Modify: `packages/server/src/media/storage.ts`
- Modify: `packages/server/src/media/handler.ts`
- Modify: `packages/server/package.json`
- Modify: `packages/renderer/src/defaults/components/Image.astro`

### Step 1: Install sharp

- [ ] **Add sharp dependency**

Run: `cd packages/server && bun add sharp`

### Step 2: Write failing tests for optimizer

- [ ] **Create test file**

```typescript
// packages/server/test/media/optimizer.test.ts
import { test, expect, describe, afterAll } from "bun:test"
import { mkdirSync, rmSync, existsSync } from "node:fs"
import { join } from "node:path"
import { createImageOptimizer } from "../../src/media/optimizer"

const testDir = "test-optimized-uploads"

describe("createImageOptimizer", () => {
  afterAll(() => {
    try { rmSync(testDir, { recursive: true }) } catch {}
  })

  test("processImage() generates WebP variant", async () => {
    mkdirSync(testDir, { recursive: true })
    const optimizer = createImageOptimizer(testDir)

    // Create a minimal 2x2 red PNG (smallest valid PNG)
    const { default: sharp } = await import("sharp")
    const inputBuffer = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
    }).png().toBuffer()

    const inputPath = join(testDir, "test-input.png")
    await Bun.write(inputPath, inputBuffer)

    const result = await optimizer.processImage(inputPath, "test-id")

    expect(result.width).toBe(100)
    expect(result.height).toBe(100)
    expect(result.variants.length).toBeGreaterThanOrEqual(1)
    expect(result.variants.some((v) => v.format === "webp")).toBe(true)
  })

  test("processImage() extracts dimensions", async () => {
    const optimizer = createImageOptimizer(testDir)

    const { default: sharp } = await import("sharp")
    const inputBuffer = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 0, g: 0, b: 255 } },
    }).png().toBuffer()

    const inputPath = join(testDir, "test-dimensions.png")
    await Bun.write(inputPath, inputBuffer)

    const result = await optimizer.processImage(inputPath, "dim-test")
    expect(result.width).toBe(800)
    expect(result.height).toBe(600)
  })

  test("processImage() generates blur placeholder", async () => {
    const optimizer = createImageOptimizer(testDir)

    const { default: sharp } = await import("sharp")
    const inputBuffer = await sharp({
      create: { width: 200, height: 200, channels: 3, background: { r: 0, g: 255, b: 0 } },
    }).png().toBuffer()

    const inputPath = join(testDir, "test-blur.png")
    await Bun.write(inputPath, inputBuffer)

    const result = await optimizer.processImage(inputPath, "blur-test")
    expect(result.blurDataURL).toBeDefined()
    expect(result.blurDataURL).toMatch(/^data:image\//)
  })

  test("processImage() generates responsive variants for large images", async () => {
    const optimizer = createImageOptimizer(testDir)

    const { default: sharp } = await import("sharp")
    const inputBuffer = await sharp({
      create: { width: 2000, height: 1500, channels: 3, background: { r: 128, g: 128, b: 128 } },
    }).png().toBuffer()

    const inputPath = join(testDir, "test-large.png")
    await Bun.write(inputPath, inputBuffer)

    const result = await optimizer.processImage(inputPath, "large-test")
    // Should generate variants for widths smaller than original
    const widths = result.variants.map((v) => v.width)
    expect(widths.some((w) => w <= 640)).toBe(true)
    expect(widths.some((w) => w <= 1024)).toBe(true)
  })
})
```

- [ ] **Run test to verify it fails**

Run: `cd packages/server && bun test test/media/optimizer.test.ts`
Expected: FAIL — `createImageOptimizer` not found

### Step 3: Implement image optimizer

- [ ] **Create optimizer.ts**

```typescript
// packages/server/src/media/optimizer.ts
import sharp from "sharp"
import { join } from "node:path"
import { mkdirSync } from "node:fs"

const RESPONSIVE_WIDTHS = [640, 768, 1024, 1280, 1536]
const OUTPUT_FORMATS = ["webp", "avif"] as const

type ImageVariant = {
  width: number
  height: number
  format: string
  path: string
  size: number
}

type ProcessResult = {
  width: number
  height: number
  blurDataURL: string
  variants: ImageVariant[]
}

export function createImageOptimizer(outputDir: string) {
  mkdirSync(outputDir, { recursive: true })

  async function processImage(inputPath: string, id: string): Promise<ProcessResult> {
    const metadata = await sharp(inputPath).metadata()
    const origWidth = metadata.width ?? 0
    const origHeight = metadata.height ?? 0

    // Generate blur placeholder (tiny base64)
    const blurBuffer = await sharp(inputPath)
      .resize(20, 20, { fit: "inside" })
      .blur(10)
      .jpeg({ quality: 40 })
      .toBuffer()
    const blurDataURL = `data:image/jpeg;base64,${blurBuffer.toString("base64")}`

    const variants: ImageVariant[] = []
    const variantDir = join(outputDir, id)
    mkdirSync(variantDir, { recursive: true })

    // Generate responsive + format variants
    const targetWidths = RESPONSIVE_WIDTHS.filter((w) => w < origWidth)
    // Always include original width
    targetWidths.push(origWidth)

    for (const width of targetWidths) {
      for (const format of OUTPUT_FORMATS) {
        const filename = `${width}.${format}`
        const outputPath = join(variantDir, filename)
        const height = Math.round((width / origWidth) * origHeight)

        try {
          const pipeline = sharp(inputPath).resize(width, height, { fit: "inside", withoutEnlargement: true })

          let result
          if (format === "webp") {
            result = await pipeline.webp({ quality: 80 }).toFile(outputPath)
          } else {
            result = await pipeline.avif({ quality: 65 }).toFile(outputPath)
          }

          variants.push({
            width: result.width,
            height: result.height,
            format,
            path: outputPath,
            size: result.size,
          })
        } catch {
          // Skip variants that fail (e.g., AVIF for very small images)
        }
      }
    }

    return { width: origWidth, height: origHeight, blurDataURL, variants }
  }

  return { processImage }
}

export type ImageOptimizer = ReturnType<typeof createImageOptimizer>
export type { ProcessResult, ImageVariant }
```

- [ ] **Run tests to verify they pass**

Run: `cd packages/server && bun test test/media/optimizer.test.ts`
Expected: All 4 tests PASS

- [ ] **Commit**

```bash
git add packages/server/src/media/optimizer.ts packages/server/test/media/optimizer.test.ts packages/server/package.json
git commit -m "feat(server): add sharp-powered image optimization pipeline"
```

### Step 4: Integrate optimizer into storage and handler

- [ ] **Modify storage.ts to store metadata in a proper record and call optimizer**

Replace the full content of `packages/server/src/media/storage.ts`:

```typescript
// packages/server/src/media/storage.ts
import { mkdirSync, existsSync, unlinkSync, rmSync } from "node:fs"
import { join } from "node:path"
import type { ImageOptimizer, ImageVariant } from "./optimizer"

export type StorageConfig = {
  provider: "local"
  path: string
}

export type MediaRecord = {
  id: string
  filename: string
  mimetype: string
  size: number
  path: string
  uploadedAt: string
  width?: number
  height?: number
  blurDataURL?: string
  variants?: ImageVariant[]
}

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "image/svg+xml"])

export function createLocalStorage(config: StorageConfig, optimizer?: ImageOptimizer) {
  const baseDir = config.path
  if (!existsSync(baseDir)) mkdirSync(baseDir, { recursive: true })

  const records = new Map<string, MediaRecord>()

  return {
    async store(file: File): Promise<MediaRecord> {
      const id = crypto.randomUUID()
      const ext = file.name.split(".").pop() || ""
      const storedName = `${id}${ext ? "." + ext : ""}`
      const filePath = join(baseDir, storedName)

      const buffer = await file.arrayBuffer()
      await Bun.write(filePath, buffer)

      const record: MediaRecord = {
        id,
        filename: file.name,
        mimetype: file.type,
        size: file.size,
        path: filePath,
        uploadedAt: new Date().toISOString(),
      }

      // Optimize images
      if (optimizer && IMAGE_MIMES.has(file.type) && file.type !== "image/svg+xml") {
        try {
          const result = await optimizer.processImage(filePath, id)
          record.width = result.width
          record.height = result.height
          record.blurDataURL = result.blurDataURL
          record.variants = result.variants
        } catch {
          // Optimization failed — serve original
        }
      }

      records.set(id, record)
      return record
    },

    list(): MediaRecord[] {
      return Array.from(records.values())
    },

    get(id: string): MediaRecord | null {
      return records.get(id) ?? null
    },

    remove(id: string): boolean {
      const record = records.get(id)
      if (!record) return false
      try { unlinkSync(record.path) } catch {}
      // Clean up variant directory
      try { rmSync(join(baseDir, id), { recursive: true }) } catch {}
      records.delete(id)
      return true
    },
  }
}
```

- [ ] **Update server/src/index.ts to create optimizer and pass to storage**

Add import:
```typescript
import { createImageOptimizer } from "./media/optimizer"
```

Replace the storage creation line:
```typescript
  const storagePath = config.storage?.path ?? "./uploads"
  const optimizer = createImageOptimizer(storagePath)
  const storage = createLocalStorage(config.storage ?? { provider: "local", path: storagePath }, optimizer)
```

- [ ] **Update handler.ts to serve variant files**

In `packages/server/src/media/handler.ts`, add a route to serve optimized files. After the `DELETE` handler:

```typescript
    // Serve variant file: /api/media/:id/:width.:format
    if (req.method === "GET" && parts.length === 2 && subpath) {
      const record = storage.get(subpath)
      if (!record) return json({ error: "Not found" }, 404)

      const variantPath = parts[1]
      if (variantPath && record.variants) {
        const variant = record.variants.find((v) => `${v.width}.${v.format}` === variantPath)
        if (variant) {
          const file = Bun.file(variant.path)
          if (await file.exists()) {
            return new Response(file, {
              headers: {
                "Content-Type": `image/${variant.format}`,
                "Cache-Control": "public, max-age=31536000, immutable",
              },
            })
          }
        }
      }
    }
```

- [ ] **Commit**

```bash
git add packages/server/src/media/storage.ts packages/server/src/media/handler.ts packages/server/src/index.ts
git commit -m "feat(server): integrate image optimizer into upload pipeline with variant serving"
```

### Step 5: Update Image.astro for responsive srcset

- [ ] **Replace Image.astro with picture tag support**

```astro
---
// packages/renderer/src/defaults/components/Image.astro
type Props = {
  src: string
  alt: string
  width?: number
  height?: number
  blurDataURL?: string
  variants?: Array<{ width: number; format: string; path: string }>
  class?: string
}

const { src, alt, width, height, blurDataURL, variants, class: className } = Astro.props

const webpVariants = (variants || [])
  .filter((v) => v.format === "webp")
  .sort((a, b) => a.width - b.width)

const avifVariants = (variants || [])
  .filter((v) => v.format === "avif")
  .sort((a, b) => a.width - b.width)

const buildSrcset = (vs: typeof webpVariants) =>
  vs.map((v) => `${v.path} ${v.width}w`).join(", ")
---

<picture>
  {avifVariants.length > 0 && (
    <source type="image/avif" srcset={buildSrcset(avifVariants)} sizes="(max-width: 768px) 100vw, 768px" />
  )}
  {webpVariants.length > 0 && (
    <source type="image/webp" srcset={buildSrcset(webpVariants)} sizes="(max-width: 768px) 100vw, 768px" />
  )}
  <img
    src={src}
    alt={alt}
    width={width}
    height={height}
    loading="lazy"
    decoding="async"
    class={className}
    style={blurDataURL ? `background-image:url(${blurDataURL});background-size:cover` : undefined}
  />
</picture>
```

- [ ] **Commit**

```bash
git add packages/renderer/src/defaults/components/Image.astro
git commit -m "feat(renderer): responsive Image component with picture/srcset/blur placeholder"
```

---

## Task B5: Error Handling + Loading States

**Files:**
- Create: `packages/admin/src/components/ErrorBoundary.tsx`
- Create: `packages/admin/src/components/Toast.tsx`
- Create: `packages/admin/src/components/LoadingSkeleton.tsx`
- Modify: `packages/admin/src/components/ContentList.tsx`
- Modify: `packages/admin/src/components/ContentEditor.tsx`

### Step 1: Create ErrorBoundary component

- [ ] **Create ErrorBoundary.tsx**

```typescript
// packages/admin/src/components/ErrorBoundary.tsx
import { Component, type ReactNode } from "react"

type Props = {
  children: ReactNode
  fallback?: ReactNode
}

type State = {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-800 font-medium mb-1">Something went wrong</p>
          <p className="text-red-600 text-sm mb-4">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 text-sm font-medium bg-white border border-red-200 rounded-lg text-red-700 hover:bg-red-50 transition-colors"
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

- [ ] **Commit**

```bash
git add packages/admin/src/components/ErrorBoundary.tsx
git commit -m "feat(admin): add ErrorBoundary component for React islands"
```

### Step 2: Create Toast notification system

- [ ] **Create Toast.tsx**

```typescript
// packages/admin/src/components/Toast.tsx
import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react"

type ToastType = "success" | "error" | "info"

type Toast = {
  id: string
  message: string
  type: ToastType
}

type ToastContextValue = {
  addToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ addToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  const colors: Record<ToastType, string> = {
    success: "bg-green-600",
    error: "bg-red-600",
    info: "bg-gray-800",
  }

  return (
    <div
      className={`${colors[toast.type]} text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-3 animate-[slideIn_0.2s_ease-out]`}
    >
      <span>{toast.message}</span>
      <button onClick={() => onDismiss(toast.id)} className="text-white/70 hover:text-white">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add packages/admin/src/components/Toast.tsx
git commit -m "feat(admin): add Toast notification system with auto-dismiss"
```

### Step 3: Create loading skeletons

- [ ] **Create LoadingSkeleton.tsx**

```typescript
// packages/admin/src/components/LoadingSkeleton.tsx

export function ContentListSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 flex gap-6">
        <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
        <div className="h-3 w-12 bg-gray-200 rounded animate-pulse" />
        <div className="h-3 w-14 bg-gray-200 rounded animate-pulse" />
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="px-6 py-4 flex items-center gap-6 border-b border-gray-100 last:border-0">
          <div className="flex-1 h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${50 + Math.random() * 30}%` }} />
          <div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse" />
          <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
        </div>
      ))}
    </div>
  )
}

export function ContentEditorSkeleton() {
  return (
    <div className="flex gap-8">
      <div className="flex-1 space-y-6">
        <div>
          <div className="h-4 w-12 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
        </div>
        <div>
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </div>
      <div className="w-72 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="flex-1 h-9 bg-gray-100 rounded-lg animate-pulse" />
            <div className="flex-1 h-9 bg-gray-100 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add packages/admin/src/components/LoadingSkeleton.tsx
git commit -m "feat(admin): add loading skeleton components for content list and editor"
```

### Step 4: Integrate ErrorBoundary, Toast, and Skeleton into ContentList

- [ ] **Update ContentList.tsx**

Replace the loading state rendering in `packages/admin/src/components/ContentList.tsx`. Replace the existing `if (loading)` block:

```typescript
  if (loading) {
    return (
      <>
        <div className="mb-4">
          <SearchBar onSearch={handleSearch} placeholder={`Search ${collectionLabel.toLowerCase()}...`} />
        </div>
        <ContentListSkeleton />
      </>
    )
  }
```

Add import at top:
```typescript
import { ContentListSkeleton } from "./LoadingSkeleton"
```

### Step 5: Integrate ErrorBoundary and Toast into ContentEditor

- [ ] **Update ContentEditor.tsx**

Add imports at top:
```typescript
import { ToastProvider, useToast } from "./Toast"
import { ErrorBoundary } from "./ErrorBoundary"
```

Wrap the entire return JSX with `<ToastProvider>` and `<ErrorBoundary>`.

Replace the success/error state handling in `handleSave`. Instead of setting `setSaved(true)` / `setError(err.message)`, use toast:

Create an inner component that uses the toast hook, or add the toast hook call at the top of the component:

```typescript
  const { addToast } = useToast()
```

Wait — `useToast` needs `ToastProvider` as an ancestor. We need to split the component. The simpler approach: wrap the export.

Instead, make `ContentEditor` an inner component and export a wrapper:

At the bottom of the file, rename the existing export:
```typescript
function ContentEditorInner({ ... }: Props) {
  // ... all existing code, but replace:
  // setSaved(true) → addToast("Saved successfully", "success")
  // setError(err.message) → addToast(err.message, "error")
  // Remove the saved/error state variables and their JSX
}

export function ContentEditor(props: Props) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ContentEditorInner {...props} />
      </ToastProvider>
    </ErrorBoundary>
  )
}
```

In the inner component, add `const { addToast } = useToast()` and replace:
- `setSaved(true)` → `addToast("Saved successfully", "success")`
- `setError(err.message)` → `addToast(err.message, "error")`
- Remove the `saved` and `error` state variables
- Remove the `{error && ...}` and `{saved && ...}` JSX blocks from the sidebar

- [ ] **Improve REST handler error messages**

In `packages/server/src/rest/handler.ts`, update the catch block at the bottom of the handler:

```typescript
    } catch (err: any) {
      const message = err.message || "Internal server error"
      const status = err.message?.includes("not found") ? 404 : 500
      return json({ error: message, collection: collectionName }, status)
    }
```

- [ ] **Commit**

```bash
git add packages/admin/src/components/ContentList.tsx packages/admin/src/components/ContentEditor.tsx packages/server/src/rest/handler.ts
git commit -m "feat(admin): integrate error boundaries, toasts, and loading skeletons"
```

---

## Task B6: Renderer Connected to API

**Files:**
- Modify: `packages/renderer/src/runtime/content-fetcher.ts`
- Modify: `packages/renderer/src/pages/index.astro`
- Modify: `packages/renderer/src/pages/[...slug].astro`
- Modify: `scripts/dev.ts`

### Step 1: Fix content-fetcher getBySlug and add where support

- [ ] **Rewrite content-fetcher.ts**

Replace `packages/renderer/src/runtime/content-fetcher.ts`:

```typescript
// packages/renderer/src/runtime/content-fetcher.ts
type FetchConfig = {
  apiBase: string
}

type ContentItem = {
  id: string
  title?: string
  slug?: string
  body?: string
  status?: string
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

type ListResponse = {
  data: ContentItem[]
}

export function createContentFetcher(config: FetchConfig) {
  const { apiBase } = config

  return {
    async list(collection: string, opts?: {
      limit?: number
      offset?: number
      where?: Record<string, unknown>
      search?: string
    }): Promise<ContentItem[]> {
      const params = new URLSearchParams()
      if (opts?.limit) params.set("limit", String(opts.limit))
      if (opts?.offset) params.set("offset", String(opts.offset))
      if (opts?.search) params.set("search", opts.search)

      // Add where filters as query params
      if (opts?.where) {
        for (const [key, value] of Object.entries(opts.where)) {
          params.set(`where[${key}]`, String(value))
        }
      }

      const url = `${apiBase}/api/${collection}${params.toString() ? "?" + params.toString() : ""}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to fetch ${collection}: ${res.status}`)
      const data: ListResponse = await res.json()
      return data.data
    },

    async getById(collection: string, id: string): Promise<ContentItem | null> {
      const res = await fetch(`${apiBase}/api/${collection}/${id}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`Failed to fetch ${collection}/${id}: ${res.status}`)
      return res.json()
    },

    async getBySlug(collection: string, slug: string): Promise<ContentItem | null> {
      const res = await fetch(`${apiBase}/api/${collection}/slug/${slug}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`Failed to fetch ${collection}/slug/${slug}: ${res.status}`)
      return res.json()
    },
  }
}

export type ContentFetcher = ReturnType<typeof createContentFetcher>
export type { ContentItem, FetchConfig }
```

### Step 2: Add slug lookup route to REST handler

- [ ] **Add /api/:collection/slug/:slug route**

In `packages/server/src/rest/handler.ts`, add before the version routes block:

```typescript
      // Slug lookup: /api/:collection/slug/:slug
      if (segments.length === 3 && segments[1] === "slug") {
        const slug = segments[2]
        if (method === "GET") {
          const docs = await service.findMany({ where: { slug }, limit: 1 })
          if (docs.length === 0) return json({ error: "Not found" }, 404)
          return json(docs[0])
        }
        return json({ error: "Method not allowed" }, 405)
      }
```

Also add `where` query param support to the GET list handler. After the search block and before the regular list:

```typescript
          // Where filters from query params
          const where: Record<string, unknown> = {}
          for (const [key, val] of url.searchParams.entries()) {
            const match = key.match(/^where\[(.+)\]$/)
            if (match) where[match[1]] = val
          }
```

Then pass it to findMany:
```typescript
          const data = await service.findMany({ limit, offset, where: Object.keys(where).length > 0 ? where : undefined })
```

- [ ] **Commit**

```bash
git add packages/renderer/src/runtime/content-fetcher.ts packages/server/src/rest/handler.ts
git commit -m "feat: add slug-based content lookup and where filter support"
```

### Step 3: Wire the homepage to list published posts

- [ ] **Replace index.astro**

```astro
---
// packages/renderer/src/pages/index.astro
import DefaultLayout from "../defaults/layouts/default.astro"
import { createContentFetcher } from "../runtime/content-fetcher"

const apiBase = import.meta.env.PUBLIC_API_BASE || "http://localhost:4321"
const fetcher = createContentFetcher({ apiBase })

let posts: Array<{ title?: string; slug?: string; excerpt?: string; created_at?: string; status?: string }> = []
try {
  const allPosts = await fetcher.list("blog_post", { limit: 20 })
  posts = allPosts.filter((p) => p.status === "published")
} catch {
  // API may not be running during build
}
---
<DefaultLayout title="Home">
  <h1 class="text-4xl font-bold mb-8">Latest Posts</h1>

  {posts.length === 0 ? (
    <p class="text-gray-500">No published posts yet.</p>
  ) : (
    <div class="space-y-8">
      {posts.map((post) => (
        <article class="border-b border-gray-200 pb-8 last:border-0">
          <h2 class="text-2xl font-semibold mb-2">
            <a href={`/${post.slug || post.title}`} class="hover:text-blue-600 transition-colors">
              {post.title}
            </a>
          </h2>
          {post.excerpt && <p class="text-gray-600 mb-2">{post.excerpt}</p>}
          <time class="text-sm text-gray-400">
            {post.created_at ? new Date(post.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : ""}
          </time>
        </article>
      ))}
    </div>
  )}
</DefaultLayout>
```

### Step 4: Wire the slug page to render real content

- [ ] **Replace [...slug].astro**

```astro
---
// packages/renderer/src/pages/[...slug].astro
import DefaultLayout from "../defaults/layouts/default.astro"
import { createContentFetcher } from "../runtime/content-fetcher"
import { portableTextToHtml } from "../runtime/channel"

const apiBase = import.meta.env.PUBLIC_API_BASE || "http://localhost:4321"
const fetcher = createContentFetcher({ apiBase })

const { slug } = Astro.params
const slugPath = slug || ""

// Try each collection until we find a match
let post = null
const collections = ["blog_post", "page"]

for (const collection of collections) {
  try {
    post = await fetcher.getBySlug(collection, slugPath)
    if (post) break
  } catch {
    // Continue to next collection
  }
}

if (!post) {
  return Astro.redirect("/404")
}

// Parse body from Portable Text JSON
let bodyHtml = ""
if (post.body) {
  try {
    const blocks = typeof post.body === "string" ? JSON.parse(post.body) : post.body
    bodyHtml = portableTextToHtml(blocks)
  } catch {
    bodyHtml = "<p>Error rendering content.</p>"
  }
}
---
<DefaultLayout title={String(post.title || slugPath)}>
  <article class="prose prose-gray max-w-none">
    <h1>{post.title}</h1>
    {post.created_at && (
      <time class="text-sm text-gray-400 block mb-8">
        {new Date(post.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </time>
    )}
    <Fragment set:html={bodyHtml} />
  </article>
</DefaultLayout>
```

- [ ] **Commit**

```bash
git add packages/renderer/src/pages/index.astro packages/renderer/src/pages/[...slug].astro
git commit -m "feat(renderer): wire pages to fetch and render real content from API"
```

### Step 5: Boot renderer in the dev script

- [ ] **Update scripts/dev.ts to boot renderer alongside admin and API**

Add after the admin startup block (after `await waitForServer(http://localhost:${adminPort}...)`):

```typescript
console.log("  Starting public site renderer...")

const rendererPort = args.find(a => a.startsWith("--renderer-port="))?.split("=")[1] ?? process.env.RENDERER_PORT ?? "3000"

const renderer = Bun.spawn(["bunx", "astro", "dev", "--port", rendererPort], {
  cwd: "packages/renderer",
  env: { ...process.env, PUBLIC_API_BASE: `http://localhost:${apiPort}` },
  stdout: "ignore",
  stderr: "ignore",
})

await waitForServer(`http://localhost:${rendererPort}`, 15_000)
```

Update the shutdown handlers to also kill the renderer:
```typescript
process.on("SIGINT", () => {
  console.log("\n  Shutting down...")
  api.kill()
  admin.kill()
  renderer.kill()
  process.exit(0)
})

process.on("SIGTERM", () => {
  api.kill()
  admin.kill()
  renderer.kill()
  process.exit(0)
})

await Promise.all([api.exited, admin.exited, renderer.exited])
```

Update the banner to include the renderer URL:
```typescript
console.log(`
  not-a-cms dev server ready

  Admin:    http://localhost:${adminPort}
  Site:     http://localhost:${rendererPort}
  API:      http://localhost:${apiPort}/api
  Health:   http://localhost:${apiPort}/health
  Collab:   ws://localhost:${apiPort}/collab

  Ctrl+C to stop.
`)
```

- [ ] **Commit**

```bash
git add scripts/dev.ts
git commit -m "feat: boot public site renderer alongside admin in dev script"
```

---

## Task B7: RSS Feed with Real Content

**Files:**
- Modify: `packages/renderer/src/pages/rss.xml.ts`

### Step 1: Wire RSS to fetch real published posts

- [ ] **Replace rss.xml.ts**

```typescript
// packages/renderer/src/pages/rss.xml.ts
import { renderRSSFeed, portableTextToHtml } from "../runtime/channel"
import { createContentFetcher } from "../runtime/content-fetcher"
import type { APIRoute } from "astro"

export const GET: APIRoute = async () => {
  const apiBase = import.meta.env.PUBLIC_API_BASE || "http://localhost:4321"
  const siteUrl = import.meta.env.SITE || "http://localhost:3000"
  const fetcher = createContentFetcher({ apiBase })

  let items: Array<{
    title: string
    link: string
    description: string
    pubDate: string
    guid: string
  }> = []

  try {
    const posts = await fetcher.list("blog_post", { limit: 50 })
    const published = posts.filter((p) => p.status === "published")

    items = published.map((post) => {
      let description = ""
      if (post.body) {
        try {
          const blocks = typeof post.body === "string" ? JSON.parse(post.body) : post.body
          description = portableTextToHtml(blocks)
        } catch {
          description = String(post.excerpt || post.title || "")
        }
      }

      const slug = post.slug || post.id
      return {
        title: String(post.title || "Untitled"),
        link: `${siteUrl}/${slug}`,
        description,
        pubDate: new Date(String(post.published_at || post.created_at || "")).toUTCString(),
        guid: `${siteUrl}/${slug}`,
      }
    })
  } catch {
    // API unavailable — return empty feed
  }

  const xml = renderRSSFeed(
    {
      title: "not-a-cms",
      description: "A site powered by not-a-cms",
      siteUrl,
    },
    items,
  )

  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  })
}
```

- [ ] **Commit**

```bash
git add packages/renderer/src/pages/rss.xml.ts
git commit -m "feat(renderer): wire RSS feed to serve real published posts"
```

---

## Task B8: Deployment

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `fly.toml`

### Step 1: Create Dockerfile

- [ ] **Create Dockerfile**

```dockerfile
# Dockerfile
FROM oven/bun:1.2 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
COPY packages/core/package.json packages/core/
COPY packages/editor/package.json packages/editor/
COPY packages/admin/package.json packages/admin/
COPY packages/server/package.json packages/server/
COPY packages/renderer/package.json packages/renderer/
COPY packages/cli/package.json packages/cli/
RUN bun install --frozen-lockfile

# Build
FROM deps AS build
COPY . .
RUN bun run build

# Production
FROM base AS production
COPY --from=build /app /app

ENV NODE_ENV=production
ENV PORT=4321

# Create data directories
RUN mkdir -p /app/data /app/uploads

VOLUME ["/app/data", "/app/uploads"]

EXPOSE 4321

CMD ["bun", "packages/server/src/dev.ts"]
```

### Step 2: Create docker-compose.yml

- [ ] **Create docker-compose.yml**

```yaml
# docker-compose.yml
services:
  cms:
    build: .
    ports:
      - "4321:4321"
    volumes:
      - cms-data:/app/data
      - cms-uploads:/app/uploads
    environment:
      - PORT=4321
      - DATABASE_URL=/app/data/production.db
      - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
      - BASE_URL=${BASE_URL:-http://localhost:4321}
    restart: unless-stopped

volumes:
  cms-data:
  cms-uploads:
```

### Step 3: Create Fly.io config

- [ ] **Create fly.toml**

```toml
# fly.toml
app = "not-a-cms"
primary_region = "ord"

[build]

[env]
  PORT = "4321"

[http_service]
  internal_port = 4321
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

[mounts]
  source = "cms_data"
  destination = "/app/data"

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
```

- [ ] **Commit**

```bash
git add Dockerfile docker-compose.yml fly.toml
git commit -m "feat: add Docker and Fly.io deployment configuration"
```

---

## Post-Implementation: Update MILESTONES.md

After all tasks are complete:

- [ ] **Update MILESTONES.md to mark Phase B items as done**

Change each `- [ ]` to `- [x]` for B1 through B8, and update the "Current State" section at the top with a summary of what Phase B delivered.

- [ ] **Commit**

```bash
git add MILESTONES.md
git commit -m "docs: mark Phase B complete in milestones"
```
