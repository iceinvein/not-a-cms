# Phase A: Wire It Together — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the existing packages so a user can log in, create content with a rich text editor, and have everything driven by the schema — turning the scaffolding into a working CMS.

**Architecture:** The server exposes a new `/api/_schema` endpoint that returns all registered collections with field definitions. All admin pages read from this endpoint instead of hardcoding collections. The editor is embedded in the ContentEditor React island. Auth middleware protects admin routes. Media uploads persist to disk. Y.js WebSocket handler enables real-time collaboration. Slug auto-generates from title.

**Tech Stack:** Bun, Astro, React, Tiptap, Y.js, Better Auth, Drizzle ORM

---

## File Structure (changes only)

```
packages/
├── server/src/
│   ├── index.ts                        MODIFY — add /api/_schema, /collab, /api/media routes
│   ├── schema/
│   │   └── handler.ts                  CREATE — schema metadata endpoint
│   ├── media/
│   │   ├── handler.ts                  CREATE — upload/serve endpoint
│   │   └── storage.ts                  CREATE — file storage abstraction (local/S3)
│   ├── collab/
│   │   └── handler.ts                  CREATE — Y.js WebSocket handler
│   └── auth/
│       └── middleware.ts               MODIFY — add cookie session extraction
├── server/test/
│   ├── schema/
│   │   └── handler.test.ts             CREATE
│   ├── media/
│   │   └── handler.test.ts             CREATE
│   └── collab/
│       └── handler.test.ts             CREATE
├── core/src/
│   └── content/
│       └── slugify.ts                  CREATE — slug generation utility
├── core/test/
│   └── content/
│       └── slugify.test.ts             CREATE
├── admin/src/
│   ├── components/
│   │   ├── ContentEditor.tsx           MODIFY — embed real <Editor>, add slug auto-gen
│   │   └── SchemaProvider.tsx          CREATE — fetch and provide schema context
│   ├── pages/
│   │   ├── index.astro                 MODIFY — read collections from schema API
│   │   ├── content/
│   │   │   ├── [collection].astro      MODIFY — read from schema API
│   │   │   └── [collection]/
│   │   │       ├── new.astro           MODIFY — read from schema API
│   │   │       └── [id].astro          MODIFY — read from schema API
│   │   └── login.astro                 MODIFY — wire real auth flow
│   └── layouts/
│       └── AdminLayout.astro           MODIFY — read collections from schema API
```

---

## Task 1: Schema Metadata API Endpoint

**Files:**
- Create: `packages/server/src/schema/handler.ts`
- Modify: `packages/server/src/index.ts`
- Test: `packages/server/test/schema/handler.test.ts`

The server needs to expose what collections exist so the admin can be dynamic.

- [ ] **Step 1: Write failing test for schema endpoint**

```typescript
// packages/server/test/schema/handler.test.ts
import { test, expect, describe, beforeAll, afterAll } from "bun:test"
import { createServer } from "../../src/index"
import { defineCollection, field } from "@not-a-cms/core"
import { unlinkSync } from "node:fs"

const testDbPath = "test-schema-api.db"

const blogPost = defineCollection({
  name: "blog_post",
  labels: { singular: "Blog Post", plural: "Blog Posts" },
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    slug: field.slug({ from: "title" }),
    body: field.richText(),
    status: field.select(["draft", "published"], { default: "draft" }),
  },
})

const page = defineCollection({
  name: "page",
  fields: {
    title: field.text({ required: true }),
    slug: field.slug({ from: "title" }),
    body: field.richText(),
    status: field.select(["draft", "published"], { default: "draft" }),
  },
})

describe("schema API", () => {
  let baseUrl: string
  let server: ReturnType<typeof createServer>

  beforeAll(() => {
    server = createServer({
      port: 0,
      database: { url: testDbPath },
      auth: {
        secret: "a".repeat(32),
        baseURL: "http://localhost",
        magicLink: { sendMagicLink: async () => {} },
      },
      collections: [blogPost, page],
    })
    baseUrl = `http://localhost:${server.server.port}`
  })

  afterAll(() => {
    server.server.stop()
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("GET /api/_schema returns all collections", async () => {
    const res = await fetch(`${baseUrl}/api/_schema`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.collections).toHaveLength(2)
  })

  test("each collection has name, labels, and fields", async () => {
    const res = await fetch(`${baseUrl}/api/_schema`)
    const data = await res.json()
    const blog = data.collections.find((c: any) => c.name === "blog_post")
    expect(blog).toBeDefined()
    expect(blog.labels.singular).toBe("Blog Post")
    expect(blog.fields.title).toBeDefined()
    expect(blog.fields.title.type).toBe("text")
    expect(blog.fields.title.required).toBe(true)
  })

  test("GET /api/_schema/:collection returns a single collection", async () => {
    const res = await fetch(`${baseUrl}/api/_schema/blog_post`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe("blog_post")
    expect(data.fields.body.type).toBe("richText")
  })

  test("GET /api/_schema/:unknown returns 404", async () => {
    const res = await fetch(`${baseUrl}/api/_schema/nonexistent`)
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && bun test test/schema/handler.test.ts`
Expected: FAIL (404 from server — route doesn't exist yet)

- [ ] **Step 3: Create schema handler**

```typescript
// packages/server/src/schema/handler.ts
import type { CollectionDef } from "@not-a-cms/core"

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export function createSchemaHandler(collections: Map<string, { def: CollectionDef }>) {
  return async function handleSchema(req: Request): Promise<Response | null> {
    const url = new URL(req.url)
    const path = url.pathname

    if (!path.startsWith("/api/_schema")) return null

    const collectionName = path.replace("/api/_schema", "").replace(/^\//, "")

    if (!collectionName) {
      // Return all collections
      const all = Array.from(collections.values()).map(({ def }) => ({
        name: def.name,
        labels: def.labels,
        fields: def.fields,
      }))
      return json({ collections: all })
    }

    // Return single collection
    const entry = collections.get(collectionName)
    if (!entry) return json({ error: `Collection '${collectionName}' not found` }, 404)

    return json({
      name: entry.def.name,
      labels: entry.def.labels,
      fields: entry.def.fields,
    })
  }
}
```

- [ ] **Step 4: Wire schema handler into server**

In `packages/server/src/index.ts`, add after the auth route and before tRPC:

```typescript
import { createSchemaHandler } from "./schema/handler"

// Inside createServer(), after building collections Map:
const schemaHandler = createSchemaHandler(collections)

// Inside fetch handler, add before tRPC routes:
if (url.pathname.startsWith("/api/_schema")) {
  const res = await schemaHandler(req)
  if (res) return res
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/server && bun test test/schema/handler.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/schema/ packages/server/test/schema/ packages/server/src/index.ts
git commit -m "feat(server): add /api/_schema endpoint for collection metadata"
```

---

## Task 2: Schema-Driven Admin Pages

**Files:**
- Create: `packages/admin/src/components/SchemaProvider.tsx`
- Modify: `packages/admin/src/layouts/AdminLayout.astro`
- Modify: `packages/admin/src/pages/index.astro`
- Modify: `packages/admin/src/pages/content/[collection].astro`
- Modify: `packages/admin/src/pages/content/[collection]/new.astro`
- Modify: `packages/admin/src/pages/content/[collection]/[id].astro`

Replace every hardcoded `collections` array with a server-side fetch to `/api/_schema`. Astro pages fetch in the frontmatter (server-side), so no client-side loading needed for navigation.

- [ ] **Step 1: Create a shared schema fetcher for Astro pages**

Since multiple Astro pages need the same data, create a utility:

```typescript
// packages/admin/src/lib/schema.ts
const API_BASE = "http://localhost:4321"

export type SchemaCollection = {
  name: string
  labels: { singular: string; plural: string }
  fields: Record<string, any>
}

export async function fetchCollections(): Promise<SchemaCollection[]> {
  try {
    const res = await fetch(`${API_BASE}/api/_schema`)
    if (!res.ok) return []
    const data = await res.json()
    return data.collections ?? []
  } catch {
    return []
  }
}

export async function fetchCollection(name: string): Promise<SchemaCollection | null> {
  try {
    const res = await fetch(`${API_BASE}/api/_schema/${name}`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Update AdminLayout.astro** to accept collections or fetch them

Replace the collections prop pattern — the layout fetches collections itself if none are passed:

```astro
---
import Sidebar from "../components/Sidebar.astro"
import { fetchCollections } from "../lib/schema"

interface Props {
  title: string
}

const { title } = Astro.props
const currentPath = Astro.url.pathname
const collections = await fetchCollections()
---
```

Remove `collections` from the Props interface entirely — it always fetches.

- [ ] **Step 3: Update index.astro (dashboard)**

Replace hardcoded collections array:

```astro
---
import AdminLayout from "../layouts/AdminLayout.astro"
import { DashboardStats } from "../components/DashboardStats"
import { fetchCollections } from "../lib/schema"

const collections = await fetchCollections()
---
<AdminLayout title="Dashboard">
  <!-- Quick Actions now use fetched collections -->
  {collections.map(c => (
    <a href={`/content/${c.name}/new`} class="...">
      + New {c.labels.singular}
    </a>
  ))}
</AdminLayout>
```

- [ ] **Step 4: Update [collection].astro** — remove hardcoded fields, use schema API

```astro
---
import AdminLayout from "../../layouts/AdminLayout.astro"
import { ContentList } from "../../components/ContentList"
import { fetchCollection } from "../../lib/schema"

const { collection } = Astro.params
const schema = await fetchCollection(collection!)
const label = schema?.labels.plural || collection || "Content"

if (!schema) return Astro.redirect("/")
---
<AdminLayout title={label}>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <p class="text-sm text-gray-500">Manage your {label.toLowerCase()}</p>
      <a href={`/content/${collection}/new`}
        class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
        + New
      </a>
    </div>
    <ContentList client:load collection={collection!} collectionLabel={label} />
  </div>
</AdminLayout>
```

- [ ] **Step 5: Update new.astro** — pass fields from schema API

```astro
---
import AdminLayout from "../../../layouts/AdminLayout.astro"
import { ContentEditor } from "../../../components/ContentEditor"
import { fetchCollection } from "../../../lib/schema"

const { collection } = Astro.params
const schema = await fetchCollection(collection!)

if (!schema) return Astro.redirect("/")

const label = schema.labels.singular
---
<AdminLayout title={`New ${label}`}>
  <ContentEditor
    client:load
    collection={collection!}
    collectionLabel={label}
    fields={schema.fields}
  />
</AdminLayout>
```

- [ ] **Step 6: Update [id].astro** — same pattern, plus pass documentId

```astro
---
import AdminLayout from "../../../layouts/AdminLayout.astro"
import { ContentEditor } from "../../../components/ContentEditor"
import { fetchCollection } from "../../../lib/schema"

const { collection, id } = Astro.params
const schema = await fetchCollection(collection!)

if (!schema) return Astro.redirect("/")

const label = schema.labels.singular
---
<AdminLayout title={`Edit ${label}`}>
  <ContentEditor
    client:load
    collection={collection!}
    collectionLabel={label}
    fields={schema.fields}
    documentId={id}
  />
</AdminLayout>
```

- [ ] **Step 7: Commit**

```bash
git add packages/admin/src/
git commit -m "feat(admin): make all pages schema-driven via /api/_schema"
```

---

## Task 3: Embed Editor in Admin

**Files:**
- Modify: `packages/admin/src/components/ContentEditor.tsx`

This is the highest-impact change — replacing the richText placeholder with the real Tiptap editor.

- [ ] **Step 1: Add the Editor import and embed it in the richText case**

In `packages/admin/src/components/ContentEditor.tsx`, replace the `case "richText"` block. The editor needs to:
- Load initial content as Portable Text (parse from JSON string if stored as string in DB)
- Call `updateField(name, serializedPT)` on change
- Style the editor area with a border and min-height

Replace the existing `case "richText":` in `renderField`:

```tsx
case "richText": {
  // Import at top of file: import { Editor } from "@not-a-cms/editor"
  const ptContent = (() => {
    try {
      const raw = value as string
      return raw ? JSON.parse(raw) : undefined
    } catch {
      return undefined
    }
  })()

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden min-h-[300px]">
      <Editor
        content={ptContent}
        onChange={(blocks) => updateField(name, JSON.stringify(blocks))}
        placeholder="Type / to insert, or just start writing..."
      />
    </div>
  )
}
```

Also add at the top of the file:
```typescript
import { Editor } from "@not-a-cms/editor"
```

- [ ] **Step 2: Add document loading for edit pages**

The ContentEditor currently doesn't fetch existing data when `documentId` is provided. Add a `useEffect` to load the document:

```tsx
// Inside ContentEditor, after the state declarations:
useEffect(() => {
  if (documentId) {
    fetch(`${apiBase}/api/${collection}/${documentId}`)
      .then((res) => res.ok ? res.json() : null)
      .then((doc) => { if (doc) setData(doc) })
      .catch(() => {})
  }
}, [documentId, collection, apiBase])
```

Add `useEffect` to the React import at the top.

- [ ] **Step 3: Commit**

```bash
git add packages/admin/src/components/ContentEditor.tsx
git commit -m "feat(admin): embed Tiptap editor for richText fields with Portable Text I/O"
```

---

## Task 4: Slug Auto-Generation

**Files:**
- Create: `packages/core/src/content/slugify.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/admin/src/components/ContentEditor.tsx`
- Test: `packages/core/test/content/slugify.test.ts`

- [ ] **Step 1: Write failing test for slugify**

```typescript
// packages/core/test/content/slugify.test.ts
import { test, expect, describe } from "bun:test"
import { slugify } from "../../src/content/slugify"

describe("slugify", () => {
  test("converts to lowercase", () => {
    expect(slugify("Hello World")).toBe("hello-world")
  })

  test("replaces spaces with hyphens", () => {
    expect(slugify("my blog post")).toBe("my-blog-post")
  })

  test("removes special characters", () => {
    expect(slugify("Hello, World! #1")).toBe("hello-world-1")
  })

  test("collapses multiple hyphens", () => {
    expect(slugify("hello---world")).toBe("hello-world")
  })

  test("trims leading and trailing hyphens", () => {
    expect(slugify(" -hello world- ")).toBe("hello-world")
  })

  test("handles empty string", () => {
    expect(slugify("")).toBe("")
  })

  test("handles unicode characters", () => {
    expect(slugify("café résumé")).toBe("cafe-resume")
  })

  test("handles numbers", () => {
    expect(slugify("Top 10 Tips for 2026")).toBe("top-10-tips-for-2026")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bun test test/content/slugify.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement slugify**

```typescript
// packages/core/src/content/slugify.ts
export function slugify(text: string): string {
  return text
    .normalize("NFD")                    // decompose accented characters
    .replace(/[\u0300-\u036f]/g, "")     // strip diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")       // remove non-alphanumeric except spaces/hyphens
    .replace(/[\s]+/g, "-")              // replace spaces with hyphens
    .replace(/-+/g, "-")                 // collapse multiple hyphens
    .replace(/^-|-$/g, "")              // trim leading/trailing hyphens
}
```

- [ ] **Step 4: Export from core**

Add to `packages/core/src/index.ts`:
```typescript
export { slugify } from "./content/slugify"
```

Also add to `packages/core/src/content/index.ts`:
```typescript
export { slugify } from "./slugify"
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/core && bun test test/content/slugify.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 6: Wire slug auto-generation into ContentEditor**

In `ContentEditor.tsx`, find the `case "slug"` in `renderField` and add auto-generation from the source field. The `fieldDef.from` tells us which field to slugify from:

```tsx
case "slug": {
  const sourceField = fieldDef.from as string | undefined
  const handleAutoGenerate = () => {
    if (sourceField && data[sourceField]) {
      // Import slugify at top: import { slugify } from "@not-a-cms/core"
      const generated = slugify(String(data[sourceField]))
      updateField(name, generated)
    }
  }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={String(value)}
        onChange={(e) => updateField(name, e.target.value)}
        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder={sourceField ? `Auto-generated from ${sourceField}` : ""}
      />
      {sourceField && (
        <button
          type="button"
          onClick={handleAutoGenerate}
          className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
        >
          Generate
        </button>
      )}
    </div>
  )
}
```

Add import at top of ContentEditor.tsx:
```typescript
import { slugify } from "@not-a-cms/core"
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/content/slugify.ts packages/core/test/content/slugify.test.ts packages/core/src/index.ts packages/core/src/content/index.ts packages/admin/src/components/ContentEditor.tsx
git commit -m "feat: add slug auto-generation from title field"
```

---

## Task 5: Media Upload Endpoint + Storage

**Files:**
- Create: `packages/server/src/media/storage.ts`
- Create: `packages/server/src/media/handler.ts`
- Modify: `packages/server/src/index.ts`
- Modify: `packages/admin/src/components/MediaLibrary.tsx`
- Test: `packages/server/test/media/handler.test.ts`

- [ ] **Step 1: Write failing test for media upload**

```typescript
// packages/server/test/media/handler.test.ts
import { test, expect, describe, beforeAll, afterAll } from "bun:test"
import { createServer } from "../../src/index"
import { defineCollection, field } from "@not-a-cms/core"
import { unlinkSync, rmSync, existsSync } from "node:fs"

const testDbPath = "test-media.db"
const uploadsDir = "./test-uploads"

const page = defineCollection({
  name: "page",
  fields: { title: field.text() },
})

describe("media API", () => {
  let baseUrl: string
  let server: ReturnType<typeof createServer>

  beforeAll(() => {
    server = createServer({
      port: 0,
      database: { url: testDbPath },
      auth: {
        secret: "a".repeat(32),
        baseURL: "http://localhost",
        magicLink: { sendMagicLink: async () => {} },
      },
      collections: [page],
      storage: { provider: "local", path: uploadsDir },
    })
    baseUrl = `http://localhost:${server.server.port}`
  })

  afterAll(() => {
    server.server.stop()
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
    if (existsSync(uploadsDir)) rmSync(uploadsDir, { recursive: true })
  })

  test("POST /api/media/upload stores a file and returns metadata", async () => {
    const formData = new FormData()
    formData.append("file", new Blob(["hello world"], { type: "text/plain" }), "test.txt")

    const res = await fetch(`${baseUrl}/api/media/upload`, {
      method: "POST",
      body: formData,
    })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.id).toBeDefined()
    expect(data.filename).toBe("test.txt")
    expect(data.mimetype).toBe("text/plain")
    expect(data.size).toBeGreaterThan(0)
  })

  test("GET /api/media lists uploaded files", async () => {
    const res = await fetch(`${baseUrl}/api/media`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.data.length).toBeGreaterThanOrEqual(1)
  })

  test("GET /api/media/:id returns file metadata", async () => {
    const listRes = await fetch(`${baseUrl}/api/media`)
    const list = await listRes.json()
    const id = list.data[0].id

    const res = await fetch(`${baseUrl}/api/media/${id}`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.filename).toBe("test.txt")
  })

  test("DELETE /api/media/:id removes a file", async () => {
    const listRes = await fetch(`${baseUrl}/api/media`)
    const list = await listRes.json()
    const id = list.data[0].id

    const res = await fetch(`${baseUrl}/api/media/${id}`, { method: "DELETE" })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.deleted).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement local file storage**

```typescript
// packages/server/src/media/storage.ts
import { mkdirSync, existsSync, unlinkSync, readdirSync } from "node:fs"
import { join } from "node:path"

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
}

export function createLocalStorage(config: StorageConfig) {
  const baseDir = config.path
  if (!existsSync(baseDir)) mkdirSync(baseDir, { recursive: true })

  // In-memory registry (production would use a _media DB table)
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
      records.delete(id)
      return true
    },
  }
}
```

- [ ] **Step 4: Implement media HTTP handler**

```typescript
// packages/server/src/media/handler.ts
import type { createLocalStorage } from "./storage"

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export function createMediaHandler(storage: ReturnType<typeof createLocalStorage>) {
  return async function handleMedia(req: Request): Promise<Response | null> {
    const url = new URL(req.url)
    if (!url.pathname.startsWith("/api/media")) return null

    const parts = url.pathname.replace("/api/media", "").split("/").filter(Boolean)
    const subpath = parts[0]

    if (req.method === "POST" && (subpath === "upload" || !subpath)) {
      const formData = await req.formData()
      const file = formData.get("file") as File | null
      if (!file) return json({ error: "No file provided" }, 400)

      const record = await storage.store(file)
      return json(record, 201)
    }

    if (req.method === "GET" && !subpath) {
      return json({ data: storage.list() })
    }

    if (req.method === "GET" && subpath) {
      const record = storage.get(subpath)
      if (!record) return json({ error: "Not found" }, 404)
      return json(record)
    }

    if (req.method === "DELETE" && subpath) {
      const deleted = storage.remove(subpath)
      return json({ deleted })
    }

    return json({ error: "Method not allowed" }, 405)
  }
}
```

- [ ] **Step 5: Wire media into server**

Add to `ServerConfig` type:
```typescript
storage?: { provider: "local"; path: string }
```

In `createServer()`, after creating the database:
```typescript
import { createLocalStorage } from "./media/storage"
import { createMediaHandler } from "./media/handler"

const storage = createLocalStorage(config.storage ?? { provider: "local", path: "./uploads" })
const mediaHandler = createMediaHandler(storage)
```

In the fetch handler, add before the generic REST routes:
```typescript
if (url.pathname.startsWith("/api/media")) {
  const res = await mediaHandler(req)
  if (res) return res
}
```

- [ ] **Step 6: Update MediaLibrary.tsx to upload to real endpoint**

Replace the fake `URL.createObjectURL` upload in `handleUpload` with a real `fetch`:

```tsx
const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files
  if (!files?.length) return

  setUploading(true)
  try {
    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch(`${apiBase}/api/media/upload`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) throw new Error("Upload failed")
      const record = await res.json()
      setItems((prev) => [record, ...prev])
    }
  } catch (err: any) {
    // Could add error state here
    console.error("Upload failed:", err)
  } finally {
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }
}
```

Also add a `useEffect` to load existing media on mount:
```tsx
useEffect(() => {
  fetch(`${apiBase}/api/media`)
    .then((res) => res.ok ? res.json() : { data: [] })
    .then((data) => setItems(data.data || []))
    .catch(() => {})
}, [apiBase])
```

- [ ] **Step 7: Run tests**

Run: `cd packages/server && bun test test/media/handler.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/media/ packages/server/test/media/ packages/server/src/index.ts packages/admin/src/components/MediaLibrary.tsx
git commit -m "feat: add media upload endpoint with local storage and admin integration"
```

---

## Task 6: Y.js WebSocket Collaboration Handler

**Files:**
- Create: `packages/server/src/collab/handler.ts`
- Modify: `packages/server/src/index.ts`
- Test: `packages/server/test/collab/handler.test.ts`

- [ ] **Step 1: Write failing test for collab WebSocket**

```typescript
// packages/server/test/collab/handler.test.ts
import { test, expect, describe, beforeAll, afterAll } from "bun:test"
import { createServer } from "../../src/index"
import { defineCollection, field } from "@not-a-cms/core"
import { unlinkSync } from "node:fs"

const testDbPath = "test-collab.db"

const page = defineCollection({
  name: "page",
  fields: { title: field.text() },
})

describe("collab WebSocket", () => {
  let baseUrl: string
  let wsUrl: string
  let server: ReturnType<typeof createServer>

  beforeAll(() => {
    server = createServer({
      port: 0,
      database: { url: testDbPath },
      auth: {
        secret: "a".repeat(32),
        baseURL: "http://localhost",
        magicLink: { sendMagicLink: async () => {} },
      },
      collections: [page],
    })
    const port = server.server.port
    baseUrl = `http://localhost:${port}`
    wsUrl = `ws://localhost:${port}`
  })

  afterAll(() => {
    server.server.stop()
    try { unlinkSync(testDbPath) } catch {}
    try { unlinkSync(testDbPath + "-wal") } catch {}
    try { unlinkSync(testDbPath + "-shm") } catch {}
  })

  test("WebSocket connects to /collab", async () => {
    const ws = new WebSocket(`${wsUrl}/collab?doc=test-doc`)

    const connected = await new Promise<boolean>((resolve) => {
      ws.onopen = () => resolve(true)
      ws.onerror = () => resolve(false)
      setTimeout(() => resolve(false), 3000)
    })

    expect(connected).toBe(true)
    ws.close()
  })

  test("WebSocket receives messages", async () => {
    const ws = new WebSocket(`${wsUrl}/collab?doc=test-doc-2`)

    await new Promise<void>((resolve) => {
      ws.onopen = () => resolve()
    })

    // Send a Y.js-style update (binary)
    const update = new Uint8Array([1, 2, 3, 4])
    ws.send(update)

    // The server should accept without error
    await Bun.sleep(100)
    expect(ws.readyState).toBe(WebSocket.OPEN)
    ws.close()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement Y.js WebSocket handler**

```typescript
// packages/server/src/collab/handler.ts
import * as Y from "yjs"

// In-memory document store (production: persist snapshots to DB)
const docs = new Map<string, Y.Doc>()

export function getOrCreateDoc(docName: string): Y.Doc {
  if (!docs.has(docName)) {
    docs.set(docName, new Y.Doc())
  }
  return docs.get(docName)!
}

export type CollabWSData = {
  docName: string
}

export const collabWebSocket = {
  open(ws: any) {
    const { docName } = ws.data as CollabWSData
    const doc = getOrCreateDoc(docName)

    // Send current state to new client
    const state = Y.encodeStateAsUpdate(doc)
    ws.send(state)

    // Subscribe to this document's updates
    ws.subscribe(docName)
  },

  message(ws: any, message: string | Buffer) {
    const { docName } = ws.data as CollabWSData
    const doc = getOrCreateDoc(docName)

    const update = new Uint8Array(message as ArrayBuffer)
    Y.applyUpdate(doc, update)

    // Broadcast to all other clients in this document room
    ws.publish(docName, update)
  },

  close(ws: any) {
    const { docName } = ws.data as CollabWSData
    ws.unsubscribe(docName)
  },
}
```

- [ ] **Step 4: Wire WebSocket into Bun.serve()**

Modify `packages/server/src/index.ts` to add WebSocket support:

In the `Bun.serve()` options, add the `websocket` handler and upgrade logic in `fetch`:

```typescript
import { collabWebSocket, type CollabWSData } from "./collab/handler"

const server = Bun.serve<CollabWSData>({
  port,
  async fetch(req, server) {
    const url = new URL(req.url)

    // WebSocket upgrade for collaboration
    if (url.pathname === "/collab") {
      const docName = url.searchParams.get("doc") ?? "default"
      const upgraded = server.upgrade<CollabWSData>(req, {
        data: { docName },
      })
      if (upgraded) return undefined as any
      return new Response("WebSocket upgrade failed", { status: 500 })
    }

    // ... rest of existing routes ...
  },

  websocket: collabWebSocket,
})
```

- [ ] **Step 5: Add yjs dependency to server package**

```bash
cd packages/server && bun add yjs
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd packages/server && bun test test/collab/handler.test.ts`
Expected: All 2 tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/collab/ packages/server/test/collab/ packages/server/src/index.ts packages/server/package.json
git commit -m "feat(server): add Y.js WebSocket handler for real-time collaboration"
```

---

## Task 7: Auth Middleware on Admin Routes

**Files:**
- Modify: `packages/server/src/auth/middleware.ts`
- Modify: `packages/admin/src/layouts/AdminLayout.astro`
- Modify: `packages/admin/src/components/LoginForm.tsx`

This task connects the login flow end-to-end. The admin Astro pages check for a session cookie. If not authenticated, redirect to /login.

- [ ] **Step 1: Update LoginForm to handle the full magic link flow**

The current LoginForm POSTs to `/api/auth/magic-link/send`. Better Auth handles the verification callback automatically. We need to make sure the LoginForm handles success states and errors correctly. The existing implementation is already correct — it sends the request and shows "Check your email". No changes needed to LoginForm.

However, we need a callback page for when the user clicks the magic link:

```astro
---
// packages/admin/src/pages/auth/callback.astro
// Better Auth handles the magic link verification at /api/auth/magic-link/verify
// This page is shown after successful verification
---
<html>
<head><meta http-equiv="refresh" content="0;url=/" /></head>
<body>Redirecting to dashboard...</body>
</html>
```

- [ ] **Step 2: Add auth check to AdminLayout**

The admin layout should check if the user is authenticated by calling the Better Auth session endpoint. If not, redirect to /login. Since this is server-side (Astro frontmatter), it happens before the page renders:

```astro
---
// Add to top of AdminLayout.astro frontmatter, after imports:
const isLoginPage = Astro.url.pathname === "/login" || Astro.url.pathname.startsWith("/auth/")

if (!isLoginPage) {
  try {
    const sessionRes = await fetch("http://localhost:4321/api/auth/get-session", {
      headers: {
        cookie: Astro.request.headers.get("cookie") || "",
      },
    })
    const session = await sessionRes.json()
    if (!session?.user) {
      return Astro.redirect("/login")
    }
  } catch {
    // If API is down, allow access in dev mode
    // In production, redirect to login
  }
}
---
```

- [ ] **Step 3: Commit**

```bash
git add packages/admin/src/
git commit -m "feat(admin): add auth middleware — redirect to login if not authenticated"
```

---

## Task 8: Full Integration Verification

- [ ] **Step 1: Run all tests across the monorepo**

Run: `cd /Users/dikrana/Documents/workspace/not-a-cms && bun run test`
Expected: All tests pass (existing 134 + new tests from this plan)

- [ ] **Step 2: Boot the dev server and verify end-to-end**

```bash
bun run dev
```

Verify:
1. `http://localhost:4322/` — Dashboard shows collections from schema API (not hardcoded)
2. `http://localhost:4322/content/blog_post` — Content list loads from API
3. `http://localhost:4322/content/blog_post/new` — Editor is embedded (Tiptap, not placeholder)
4. Create a post with title → slug auto-generates → body uses rich text → save works
5. `http://localhost:4322/media` — Upload a file → persists to ./uploads/ directory
6. `ws://localhost:4321/collab?doc=test` — WebSocket connects

- [ ] **Step 3: Commit any fixes from verification**

- [ ] **Step 4: Final commit**

```bash
git commit -m "chore: Phase A complete — CMS is fully wired together"
```

---

## Coverage vs Milestones

| Phase A Task | Plan Task | Status |
|---|---|---|
| A1: Embed editor in admin | Task 3 | Covered |
| A2: Schema metadata API | Tasks 1 + 2 | Covered |
| A3: Auth middleware | Task 7 | Covered |
| A4: Media upload + storage | Task 5 | Covered |
| A5: Y.js WebSocket handler | Task 6 | Covered |
| A6: Slug auto-generation | Task 4 | Covered |

## Dependency Order

```
Task 1 (schema API)      → no deps
Task 4 (slugify)         → no deps
Task 5 (media)           → no deps
Task 6 (Y.js WS)        → no deps

Task 2 (schema-driven admin) → depends on Task 1
Task 3 (embed editor)        → no deps (but test after Task 2)
Task 7 (auth middleware)      → no deps (but test after Task 2)

Task 8 (verification)        → depends on all above
```

Tasks 1, 4, 5, 6 can run in parallel. Tasks 2, 3, 7 can run in parallel after Task 1. Task 8 is last.
