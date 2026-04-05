# Core Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the monorepo skeleton, schema definition engine, database layer, content CRUD, and HTTP server with tRPC + REST + passwordless auth — producing a working content API.

**Architecture:** Bun monorepo with Turborepo. `packages/core` owns the schema engine, Drizzle ORM integration, and content service. `packages/server` owns the HTTP server (Bun.serve), tRPC router, REST endpoints, and Better Auth. Core has zero dependencies on server; server imports core.

**Tech Stack:** Bun, Turborepo, Drizzle ORM (bun:sqlite), tRPC v11 (fetch adapter), Better Auth (magic link + passkey), Zod

---

## File Structure

```
not-a-cms/
├── package.json                          Bun workspace root
├── turbo.json                            Turborepo config
├── tsconfig.json                         Root TypeScript config (base)
├── .gitignore
├── packages/
│   ├── core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts                  Public API re-exports
│   │   │   ├── schema/
│   │   │   │   ├── field.ts              Field type builders (text, slug, relation, etc.)
│   │   │   │   ├── collection.ts         defineCollection() and Collection type
│   │   │   │   └── index.ts             Re-exports field + collection
│   │   │   ├── db/
│   │   │   │   ├── connection.ts         Drizzle + bun:sqlite connection factory
│   │   │   │   ├── generate-table.ts     Collection to Drizzle table definition
│   │   │   │   ├── bootstrap.ts          Dev-mode table creation from collections
│   │   │   │   └── index.ts             Re-exports
│   │   │   ├── content/
│   │   │   │   ├── service.ts            CRUD operations (create, findById, findMany, update, delete)
│   │   │   │   ├── hooks.ts             Hook runner (beforeSave, afterPublish, etc.)
│   │   │   │   └── index.ts            Re-exports
│   │   │   └── types.ts                 Shared type definitions
│   │   └── test/
│   │       ├── schema/
│   │       │   ├── field.test.ts
│   │       │   └── collection.test.ts
│   │       ├── db/
│   │       │   ├── connection.test.ts
│   │       │   └── generate-table.test.ts
│   │       └── content/
│   │           ├── service.test.ts
│   │           └── hooks.test.ts
│   └── server/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts                  Bun.serve() entry point
│       │   ├── trpc/
│       │   │   ├── router.ts             Root tRPC router
│       │   │   ├── context.ts            tRPC context (auth session, db)
│       │   │   ├── content-router.ts     Content CRUD procedures
│       │   │   └── index.ts
│       │   ├── rest/
│       │   │   ├── handler.ts            REST request handler
│       │   │   └── index.ts
│       │   └── auth/
│       │       ├── setup.ts              Better Auth instance (magic link + passkey)
│       │       ├── middleware.ts          Auth middleware for tRPC + REST
│       │       └── index.ts
│       └── test/
│           ├── trpc/
│           │   └── content-router.test.ts
│           ├── rest/
│           │   └── handler.test.ts
│           ├── auth/
│           │   └── setup.test.ts
│           └── integration.test.ts
```

---

## Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json`
- Create: `turbo.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`

- [ ] **Step 1: Create root package.json with Bun workspaces**

- [ ] **Step 2: Create turbo.json with build/dev/test tasks**

- [ ] **Step 3: Create root tsconfig.json as base config**

- [ ] **Step 4: Update .gitignore for monorepo**

- [ ] **Step 5: Create packages/core/package.json with drizzle-orm and zod**

- [ ] **Step 6: Create packages/core/tsconfig.json extending root**

- [ ] **Step 7: Create packages/server/package.json depending on @not-a-cms/core**

- [ ] **Step 8: Create packages/server/tsconfig.json extending root**

- [ ] **Step 9: Run bun install and verify workspace resolves**

Run: `bun install`

Expected: Clean install. `@not-a-cms/core` resolvable from `@not-a-cms/server`.

- [ ] **Step 10: Commit**

```bash
git add package.json turbo.json tsconfig.json .gitignore packages/core/package.json packages/core/tsconfig.json packages/server/package.json packages/server/tsconfig.json
git commit -m "chore: scaffold monorepo with core and server packages"
```

---

## Task 2: Schema Field Types

**Files:**
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/schema/field.ts`
- Test: `packages/core/test/schema/field.test.ts`

- [ ] **Step 1: Write failing test for all field builders** (text, slug, richText, number, boolean, datetime, select, relation, media, array, group)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bun test test/schema/field.test.ts`
Expected: FAIL (cannot resolve module)

- [ ] **Step 3: Create types.ts** with FieldDef union type (TextFieldDef, SlugFieldDef, RichTextFieldDef, NumberFieldDef, BooleanFieldDef, DatetimeFieldDef, SelectFieldDef, RelationFieldDef, MediaFieldDef, ArrayFieldDef, GroupFieldDef), CollectionDef, CollectionHooks, ContentHook, HookContext, FieldAccess, ContentStatus

- [ ] **Step 4: Implement field builders** in field.ts. Each builder returns a typed field definition with sensible defaults (required defaults to false).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/core && bun test test/schema/field.test.ts`
Expected: All 12 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/schema/field.ts packages/core/test/schema/field.test.ts
git commit -m "feat(core): add schema field type builders"
```

---

## Task 3: Collection Definition

**Files:**
- Create: `packages/core/src/schema/collection.ts`
- Create: `packages/core/src/schema/index.ts`
- Test: `packages/core/test/schema/collection.test.ts`

- [ ] **Step 1: Write failing test for defineCollection** (creates definition, auto-generates labels from snake_case name, stores hooks, validates snake_case naming)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bun test test/schema/collection.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement defineCollection** with snake_case validation, auto-label generation (snake_case to Title Case), simple pluralization, hook storage

- [ ] **Step 4: Create schema/index.ts** re-exporting field and defineCollection

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/core && bun test test/schema/collection.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/schema/collection.ts packages/core/src/schema/index.ts packages/core/test/schema/collection.test.ts
git commit -m "feat(core): add defineCollection with auto-labels and validation"
```

---

## Task 4: Drizzle Table Generation from Collections

**Files:**
- Create: `packages/core/src/db/connection.ts`
- Create: `packages/core/src/db/generate-table.ts`
- Create: `packages/core/src/db/bootstrap.ts`
- Create: `packages/core/src/db/index.ts`
- Test: `packages/core/test/db/generate-table.test.ts`
- Test: `packages/core/test/db/connection.test.ts`

- [ ] **Step 1: Write failing test for generateTable** (verifies table name, id column, text/number/boolean/datetime/select/relation/media/array/group/richText column mappings, created_at/updated_at columns)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bun test test/db/generate-table.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement generateTable** that converts a CollectionDef into a Drizzle sqliteTable. Column mapping:
  - text/slug/select/datetime: `text()` column
  - richText/array/group: `text()` column (stores JSON)
  - number: `integer()` column
  - boolean: `integer()` column (SQLite uses int for bool)
  - relation: `text()` column named `{field}_id`
  - media: `text()` column named `{field}_id`
  - Auto-adds: `id` (text primary key, UUID default), `created_at` (text), `updated_at` (text)
  - camelCase field names convert to snake_case column names

- [ ] **Step 4: Implement connection.ts** with `createDatabase(config)` that creates a bun:sqlite Database, enables WAL mode and foreign keys, wraps in Drizzle

- [ ] **Step 5: Write and run connection test** (verifies SELECT 1 works, WAL mode is enabled)

Run: `cd packages/core && bun test test/db/connection.test.ts`
Expected: All 2 tests PASS

- [ ] **Step 6: Implement bootstrap.ts** with `bootstrapTables(db, collections)` that generates `CREATE TABLE IF NOT EXISTS` SQL from collection definitions for dev-mode convenience. Iterates collection fields and generates column definitions matching generateTable's mapping.

- [ ] **Step 7: Create db/index.ts** re-exporting connection, generateTable, and bootstrapTables

- [ ] **Step 8: Run all db tests**

Run: `cd packages/core && bun test test/db/`
Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/db/ packages/core/test/db/
git commit -m "feat(core): add Drizzle table generation and database connection"
```

---

## Task 5: Content CRUD Service

**Files:**
- Create: `packages/core/src/content/service.ts`
- Create: `packages/core/src/content/hooks.ts`
- Create: `packages/core/src/content/index.ts`
- Test: `packages/core/test/content/service.test.ts`
- Test: `packages/core/test/content/hooks.test.ts`

- [ ] **Step 1: Write failing test for runHook** (runs hook and returns modified doc, returns original if hook returns void, returns original if no hook defined, handles async hooks)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && bun test test/content/hooks.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement runHook** in hooks.ts. Calls the named hook if it exists on the hooks object, returns the result or the original doc if result is void/undefined.

- [ ] **Step 4: Run hooks test to verify it passes**

Run: `cd packages/core && bun test test/content/hooks.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Write failing test for createContentService** (create inserts and returns with id, findById retrieves, findById returns null for missing, findMany returns all, findMany supports limit/offset, findMany supports where filter, update modifies doc, update sets updated_at, remove deletes, remove returns true/false)

- [ ] **Step 6: Run test to verify it fails**

Run: `cd packages/core && bun test test/content/service.test.ts`
Expected: FAIL

- [ ] **Step 7: Implement createContentService** returning an object with create, findById, findMany, update, remove methods. Each method:
  - Uses Drizzle query builder against the generated table
  - Runs beforeSave/afterSave hooks on create/update
  - Runs beforeDelete/afterDelete hooks on remove
  - create: generates UUID id, sets created_at/updated_at, inserts, returns the row
  - findById: SELECT WHERE id = ?, returns row or null
  - findMany: SELECT with optional limit, offset, where (eq filter on columns)
  - update: merges data with existing row, sets updated_at, returns updated row
  - remove: checks existence, deletes, returns boolean

- [ ] **Step 8: Create content/index.ts** re-exporting createContentService and runHook

- [ ] **Step 9: Run all content tests**

Run: `cd packages/core && bun test test/content/`
Expected: All 14 tests PASS

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/content/ packages/core/test/content/
git commit -m "feat(core): add content CRUD service with hooks"
```

---

## Task 6: Core Public API

**Files:**
- Create: `packages/core/src/index.ts`

- [ ] **Step 1: Create the public API re-export** exporting field, defineCollection, createDatabase, generateTable, bootstrapTables, createContentService, and all type exports from types.ts

- [ ] **Step 2: Run all core tests**

Run: `cd packages/core && bun test`
Expected: All tests PASS (~45 tests)

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): add public API re-exports"
```

---

## Task 7: tRPC Router with Content Procedures

**Files:**
- Create: `packages/server/src/trpc/context.ts`
- Create: `packages/server/src/trpc/router.ts`
- Create: `packages/server/src/trpc/content-router.ts`
- Create: `packages/server/src/trpc/index.ts`
- Test: `packages/server/test/trpc/content-router.test.ts`

- [ ] **Step 1: Write failing test for content tRPC router** (create, findById, findMany, update, remove procedures; throws for unknown collection)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && bun test test/trpc/content-router.test.ts`
Expected: FAIL

- [ ] **Step 3: Create tRPC context** with initTRPC, AppContext type (db + session), publicProcedure, protectedProcedure (checks session), createCallerFactory

- [ ] **Step 4: Create content-router** with createContentRouter function. Takes a Map of collection entries (def + table + service). Exposes procedures:
  - `create` mutation: z.object({ collection: z.string(), data: z.record(z.unknown()) })
  - `findById` query: z.object({ collection: z.string(), id: z.string() })
  - `findMany` query: z.object({ collection, limit?, offset?, where? })
  - `update` mutation: z.object({ collection, id, data })
  - `remove` mutation: z.object({ collection, id })
  - Each looks up the service from the collections Map, throws TRPCError NOT_FOUND for unknown collections

- [ ] **Step 5: Create appRouter** combining content router under `content` namespace

- [ ] **Step 6: Create trpc/index.ts** re-exports

- [ ] **Step 7: Run test to verify it passes**

Run: `cd packages/server && bun test test/trpc/content-router.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/trpc/ packages/server/test/trpc/
git commit -m "feat(server): add tRPC content router with CRUD procedures"
```

---

## Task 8: REST API Handler

**Files:**
- Create: `packages/server/src/rest/handler.ts`
- Create: `packages/server/src/rest/index.ts`
- Test: `packages/server/test/rest/handler.test.ts`

- [ ] **Step 1: Write failing test for REST handler** (POST creates 201, GET lists, GET /:id retrieves, GET /:id returns 404, PATCH updates, DELETE removes, unknown collection 404, non-API route returns null)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && bun test test/rest/handler.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement createRestHandler** that takes a collections Map and returns an async function `(req: Request) => Response | null`. Parses `/api/:collection` and `/api/:collection/:id` from URL pathname. Routes:
  - GET (no id): service.findMany with limit/offset from query params, returns `{ data: [...] }`
  - GET (with id): service.findById, returns doc or 404
  - POST: service.create from JSON body, returns 201
  - PATCH: service.update from JSON body, returns updated doc
  - DELETE: service.remove, returns `{ deleted: boolean }`
  - Returns null for non-/api/ routes
  - Returns 404 for unknown collections
  - Returns 405 for unsupported methods

- [ ] **Step 4: Create rest/index.ts** re-export

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/server && bun test test/rest/handler.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/rest/ packages/server/test/rest/
git commit -m "feat(server): add REST API handler with auto-generated CRUD routes"
```

---

## Task 9: Better Auth Setup (Passwordless)

**Files:**
- Create: `packages/server/src/auth/setup.ts`
- Create: `packages/server/src/auth/middleware.ts`
- Create: `packages/server/src/auth/index.ts`
- Test: `packages/server/test/auth/setup.test.ts`

- [ ] **Step 1: Write failing test for auth setup** (createAuth returns instance with handler, handler responds to GET /api/auth/ok)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && bun test test/auth/setup.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement createAuth** using betterAuth with:
  - drizzleAdapter(db, { provider: "sqlite" })
  - emailAndPassword: { enabled: false } (passwordless only)
  - magicLink plugin with configurable sendMagicLink callback
  - Optional OAuth providers (github, google)
  - Config type: { db, secret, baseURL, magicLink: { sendMagicLink, expiresIn? }, oauth? }

- [ ] **Step 4: Implement auth middleware** with getSessionFromRequest function that calls auth.api.getSession with request headers, returns { userId, role } or null

- [ ] **Step 5: Create auth/index.ts** re-exports

- [ ] **Step 6: Run test to verify it passes**

Run: `cd packages/server && bun test test/auth/setup.test.ts`
Expected: All 2 tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/auth/ packages/server/test/auth/
git commit -m "feat(server): add passwordless auth with Better Auth (magic link)"
```

---

## Task 10: Bun.serve() Entry Point

**Files:**
- Create: `packages/server/src/index.ts`

- [ ] **Step 1: Implement createServer** function that:
  - Takes ServerConfig: { port?, database: { url }, auth: { secret, baseURL, magicLink }, collections: CollectionDef[] }
  - Creates database via createDatabase
  - Creates auth via createAuth
  - Builds collection registry Map (def + table + service) from collection definitions
  - Calls bootstrapTables for dev convenience
  - Creates tRPC router via appRouter(collections)
  - Creates REST handler via createRestHandler(collections)
  - Starts Bun.serve with fetch handler routing:
    - /api/auth/* to auth.handler
    - /trpc/* to fetchRequestHandler from @trpc/server/adapters/fetch
    - /api/* to REST handler
    - /health to JSON { status: "ok" }
    - Everything else to 404
  - Returns { server, db, collections, trpcRouter }
  - Export AppRouter type and createServer

- [ ] **Step 2: Verify it compiles**

Run: `cd packages/server && bun build src/index.ts --outdir=dist --target=bun`
Expected: Build completes without errors

- [ ] **Step 3: Run all server tests**

Run: `cd packages/server && bun test`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/index.ts
git commit -m "feat(server): add Bun.serve() entry point combining tRPC, REST, and auth"
```

---

## Task 11: Integration Smoke Test

**Files:**
- Create: `packages/server/test/integration.test.ts`

- [ ] **Step 1: Write integration test** that:
  - Defines a blog_post collection with title, slug, body, status fields
  - Calls createServer with port 0 (random), test database, mock auth
  - Tests:
    - GET /health returns 200 with { status: "ok" }
    - Full REST lifecycle: POST creates 201, GET retrieves, GET list, PATCH updates, DELETE removes
    - GET /api/auth/ok returns 200
    - GET /unknown returns 404
  - Cleans up: stops server, deletes test DB files in afterAll

- [ ] **Step 2: Run the integration test**

Run: `cd packages/server && bun test test/integration.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 3: Run all tests across the monorepo**

Run: `bun run test` (from root)
Expected: All tests PASS across both packages (~60+ tests)

- [ ] **Step 4: Commit**

```bash
git add packages/server/test/integration.test.ts
git commit -m "test(server): add integration smoke test for full server lifecycle"
```

---

## Coverage vs Spec

| Spec Requirement | Task | Status |
|---|---|---|
| Schema definition API | Task 2 + 3 | Covered |
| Per-collection SQL tables | Task 4 | Covered |
| Content CRUD with hooks | Task 5 | Covered |
| Portable Text storage | Task 4 (richText to JSON text column) | Covered |
| tRPC internal API | Task 7 | Covered |
| REST external API | Task 8 | Covered |
| GraphQL external API | Future Plan 1b | Deferred |
| Passwordless auth | Task 9 | Covered |
| Content versioning | Future addition | Deferred |
| Y.js collaboration | Plan 2 (editor) | Deferred |
| Admin UI | Plan 3 | Deferred |
| Renderer/themes | Plan 4 | Deferred |
| CLI | Plan 5 | Deferred |
