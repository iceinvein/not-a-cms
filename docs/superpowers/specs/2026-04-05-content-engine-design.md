# not-a-cms: Content Engine Design Spec

**Date:** 2026-04-05
**Status:** Approved
**Milestone:** 1 — Content Engine (editor + content model + API)

---

## Vision

A WordPress successor built for everyone — from bloggers who never touch code to developers building headless applications. The content engine is the foundation: the best way to create, manage, and serve content. Everything else (visual site builder, automations, marketplace) layers on top in future milestones.

### Core Principles

- **Passwordless only** — no passwords anywhere in the system
- **JSON over HTML** — content stored as typed Portable Text, never raw HTML
- **TypeScript end-to-end** — schema defines types that flow to admin, API, and frontend
- **Self-hosted, zero vendor lock-in** — your data in your database, deploy anywhere
- **SSR by default, headless when needed** — works out of the box, API available for custom frontends
- **Real-time by default** — collaborative editing and live preview are baseline, not premium

---

## Architecture Overview

### Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | Bun | Fast, TypeScript-native, built-in WebSocket, SQLite, and .env support |
| Framework | Astro | Content-first, island architecture, zero JS by default, framework-agnostic |
| Editor | Tiptap (ProseMirror) | Extensible, schema-typed, first-class React and Y.js bindings |
| Real-time | Y.js (CRDT) | Battle-tested collaborative editing, offline support, character-level merge |
| Database | Drizzle ORM | TypeScript-first, works with SQLite and PostgreSQL, auto-generates migrations |
| Auth | Better Auth | Self-hosted, TypeScript-native, passwordless support, uses your existing DB |
| Internal API | tRPC | End-to-end typed, zero API contract to maintain between our own packages |
| External API | REST + GraphQL | REST for simple integrations, GraphQL for headless frontend developers |

### Monorepo Structure

```
not-a-cms/
├── packages/
│   ├── core/          → Content model, schema engine, Drizzle, migrations, hooks
│   ├── editor/        → Tiptap editor, block extensions, Y.js collaboration
│   ├── admin/         → Astro admin UI with React islands
│   ├── server/        → Bun.serve() — HTTP + WebSocket + Y.js + tRPC + REST + GraphQL
│   ├── renderer/      → Astro SSR/SSG/ISR for public sites, theme system, channel rendering
│   └── cli/           → Scaffolding, migrations, dev server, deploy tooling
├── templates/         → Starter themes (blog, portfolio, docs)
├── package.json       → Bun workspace root
└── turbo.json         → Build orchestration
```

---

## Package Details

### `packages/core` — Content Model Engine

Zero UI, zero HTTP. Pure logic for defining, storing, and querying content.

#### Schema Definition

Two paths to the same result:

**Code-first (developers):**

```typescript
import { defineCollection, field } from "@not-a-cms/core"

export const blogPost = defineCollection({
  name: "blog_post",
  labels: { singular: "Blog Post", plural: "Blog Posts" },
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    slug: field.slug({ from: "title", unique: true }),
    excerpt: field.text({ multiline: true, maxLength: 500 }),
    body: field.richText(),
    coverImage: field.media({ accept: ["image/*"] }),
    author: field.relation("user"),
    category: field.relation("category"),
    tags: field.array(field.text()),
    status: field.select(["draft", "published", "archived"], {
      default: "draft",
    }),
    publishedAt: field.datetime(),
    seo: field.group({
      metaTitle: field.text(),
      metaDescription: field.text({ maxLength: 160 }),
      ogImage: field.media(),
    }),
  },
  hooks: {
    beforeSave: (doc) => { /* auto-generate slug, validate */ },
    afterPublish: (doc) => { /* trigger rebuild, send webhook */ },
  },
})
```

**Visual builder (non-devs):** The admin UI exposes a drag-and-drop schema builder that generates the same TypeScript config. The builder writes collection files to `collections/*.ts` on disk via the dev server's filesystem API (available only in dev mode). This means visual changes are version-controllable, diffable, and produce the same Drizzle migrations as hand-written code. In production, schema changes require a redeploy — the visual builder is a dev-time tool, not a runtime mutation.

#### Storage Model

Each collection maps to its own SQL table with real typed columns:

```
blog_post table
┌─────┬───────┬──────┬────────┬──────────┬───────────┐
│ id  │ title │ slug │ status │ body     │ author_id │
│ uuid│ text  │ text │ enum   │ jsonb    │ uuid FK   │
└─────┴───────┴──────┴────────┴──────────┴───────────┘
```

- **Structured fields** (title, slug, status, relations) = real SQL columns with indexes, foreign keys, and constraints
- **Rich text body** = JSONB column containing Portable Text
- **System tables**: `_versions`, `_media`, `_users`, `_sessions`, `_webhooks`, `_api_keys`
- **Database targets**: `bun:sqlite` for development and small sites, `Bun.sql` PostgreSQL for production scale
- **Migrations**: Drizzle Kit auto-generates SQL migrations from schema changes

#### Portable Text Format

The `body` JSONB column stores content as a typed JSON array of blocks:

```json
[
  {
    "type": "paragraph",
    "children": [
      { "type": "text", "value": "Hello " },
      { "type": "text", "value": "world", "marks": ["bold"] }
    ]
  },
  {
    "type": "image",
    "mediaId": "asset_abc123",
    "alt": "A sunset",
    "caption": "Photo by Jane"
  },
  {
    "type": "embed",
    "provider": "youtube",
    "url": "https://youtube.com/watch?v=...",
    "metadata": { "title": "...", "thumbnail": "..." }
  },
  {
    "type": "callout",
    "variant": "warning",
    "children": [
      { "type": "text", "value": "This is important." }
    ]
  }
]
```

Each block is typed, independently renderable per channel, and queryable as JSON.

#### Content Lifecycle

```
Draft --> In Review --> Published --> Archived
  ^          |              |
  |          v              |
  +--- (rejected)     (unpublished)
                            |
                            v
                       Versioned
```

- **Auto-save**: debounced, every few seconds while editing
- **Versions**: created on explicit save or publish, not every keystroke
- **Scheduled publishing**: set a future `publishedAt`, a cron job promotes it
- **Version diffing**: compare any two versions, restore any previous version

#### Query API Layers

All three API layers are auto-generated from the schema and call the same underlying core service functions:

| Layer | Audience | Purpose |
|---|---|---|
| **tRPC** | Internal (admin, editor, renderer) | End-to-end typed, compile-time checks, zero overhead |
| **GraphQL** | Headless frontend developers | Flexible queries, exact fields, nested relations in one request |
| **REST** | Simple integrations and automation | Universal, cacheable, easy to debug with curl |

**REST endpoints (auto-generated per collection):**

```
GET    /api/blog-post              → list (filterable, paginated)
GET    /api/blog-post/:id          → single by ID
GET    /api/blog-post/slug/:slug   → single by slug
POST   /api/blog-post              → create
PATCH  /api/blog-post/:id          → update
DELETE /api/blog-post/:id          → delete
```

**GraphQL schema (auto-generated):**

```graphql
query {
  blogPosts(where: { status: "published" }, limit: 10, orderBy: publishedAt_DESC) {
    title
    slug
    author { name avatar }
    tags
  }
}
```

**tRPC (internal usage):**

```typescript
const posts = await trpc.blogPost.list.query({ status: "published", limit: 10 })
// Fully typed: posts is BlogPost[]
```

GraphQL schema generation uses Pothos, driven from the same Drizzle/collection definitions that power tRPC and REST.

---

### `packages/editor` — Writing Experience

A React component library built on Tiptap/ProseMirror.

#### Editor Layout

```
┌─────────────────────────────────────────────────────┐
│  Structured Fields Sidebar                          │
│  Title, category, tags, cover image, SEO, status    │
├─────────────────────────────────────────────────────┤
│  Tiptap Document Editor                             │
│                                                     │
│  Just start typing...                               │
│                                                     │
│  - Markdown shortcuts live (## → heading, ** → bold)│
│  - / slash command palette                          │
│  - Contextual toolbar on text selection             │
│  - Drag handles on blocks                           │
│  - Paste URL → auto embed                           │
│  - Collaborative cursors (Y.js)                     │
├─────────────────────────────────────────────────────┤
│  Live Preview Panel (optional, toggleable)          │
│  Shows rendered output using actual theme components│
└─────────────────────────────────────────────────────┘
```

#### Extension Architecture

Every editor capability is a Tiptap extension:

**Core extensions (always loaded):**

- `StarterKit` — paragraphs, headings, bold, italic, lists, blockquote, code, horizontal rule
- `Markdown` — type shortcuts that convert to rich formatting live
- `SlashCommand` — `/` opens the block inserter palette with search
- `Placeholder` — ghost text: "Type / to insert, or just start writing..."
- `DragHandle` — grab handle on every block for reordering
- `FloatingToolbar` — appears on text selection (bold, italic, link, highlight, code)
- `Collaboration` — Y.js binding via `y-prosemirror`
- `CollaborationCursor` — colored cursors with user names

**Built-in block extensions:**

- `Image` — upload, paste, drag-drop; alt text, caption, sizing
- `Gallery` — multi-image grid with lightbox
- `Embed` — YouTube, Twitter, Spotify, CodePen, generic oEmbed
- `BookmarkCard` — paste URL, auto-fetch title/description/favicon/preview image
- `Callout` — info, warning, success, error styled boxes
- `CodeBlock` — syntax highlighting via Shiki, language selector
- `Table` — row/column management, header rows, cell merging
- `Divider` — styled horizontal rules
- `TOC` — auto-generated table of contents from headings

#### Custom Block API

```typescript
import { defineBlock } from "@not-a-cms/editor"

export const pricingTable = defineBlock({
  name: "pricing-table",
  label: "Pricing Table",
  icon: "dollar-sign",
  group: "commerce",
  schema: {
    plans: field.array({
      name: field.text(),
      price: field.number(),
      features: field.array(field.text()),
    }),
  },
  editor: PricingTableEditor,
  toPortableText: (data) => ({ type: "pricing-table", ...data }),
})
```

Custom blocks appear in the slash command menu automatically. Developers build the editing UI; the system handles serialization, storage, and rendering.

---

### `packages/admin` — Control Panel

An Astro app with React islands for interactive parts.

#### Views

- **Dashboard** — content overview, recent activity, quick actions, presence (who's editing what)
- **Content Manager** — list, filter, full-text search, bulk actions per collection
- **Editor View** — `editor` package embedded with structured fields sidebar
- **Visual Schema Builder** — drag-and-drop content type creation for non-devs
- **Media Library** — upload, browse, search, image optimization, metadata
- **User Management** — roles, permissions, invite flow (magic link)
- **Site Settings** — theme customizer, general settings, API keys, webhooks
- **Extensions** — installed extensions, configuration

#### Content Mode vs Design Mode

Not a separate UI — the same admin with fields hidden or locked based on role:

- **Author** sees: title, body, tags, cover image (content only)
- **Editor** sees: everything an author sees + status, publish controls, SEO
- **Admin** sees: everything + layout settings, custom CSS, schema editing

---

### `packages/server` — Runtime

A single `Bun.serve()` process handling all protocols.

#### Responsibilities

```
Bun.serve()
├── HTTP
│   ├── tRPC router        → internal typed API
│   ├── REST router        → /api/* auto-generated endpoints
│   ├── GraphQL endpoint   → /graphql (Pothos schema)
│   ├── Admin routes       → /admin/* (Astro SSR)
│   ├── Public site        → /* (Astro SSR/SSG/ISR)
│   └── Asset serving      → /uploads/* with optimization
│
├── WebSocket
│   ├── Y.js rooms         → /collab (one Y.Doc per content entry)
│   └── Presence           → /presence (who's online, editing what)
│
└── Background
    ├── Cron scheduler     → scheduled publishing, cleanup
    ├── Webhook dispatcher → outbound hooks on content events
    └── Asset processor    → image optimization queue
```

#### Real-Time Collaboration

```
┌──────────┐    ┌──────────┐
│ Editor A │    │ Editor B │
│ (browser)│    │ (browser)│
└────┬─────┘    └────┬─────┘
     │ WebSocket     │ WebSocket
     ▼               ▼
┌─────────────────────────────┐
│  Y.js Document Map          │
│                             │
│  doc:post_abc123            │
│    Y.XmlFragment (body)     │  ← CRDT-synced editor state
│    Awareness (cursors)      │  ← who's where
│                             │
│  Persistence:               │
│  - Snapshot to DB every 30s │
│  - Final save on last       │
│    editor disconnect        │
│  - Y.js binary state stored │
│    alongside Portable Text  │
└─────────────────────────────┘
```

- Y.js CRDTs handle character-level merging — no conflicts possible
- Offline changes stored in IndexedDB, merge automatically on reconnect
- Presence system broadcasts who is editing what across the admin

#### Live Preview

The editor can toggle a side-by-side preview that uses the actual theme components:

```
Editor types → Y.js updates → Portable Text snapshot →
  Renderer pipeline (same Astro components as public site) →
    Preview iframe updates in real-time
```

What you see in preview is exactly what visitors will see.

---

### `packages/renderer` — Public Site

A separate Astro app for rendering the visitor-facing site.

#### Rendering Modes

Configurable per collection:

| Mode | Behavior | Best for |
|---|---|---|
| **SSG** | Pre-built at deploy time, pure HTML files | Blogs, docs, marketing pages |
| **SSR** | Rendered per request by Bun | Dynamic content, personalized pages |
| **ISR** | Cached, rebuilt in background after TTL | High-traffic pages that update occasionally |

```typescript
rendering: {
  blog_post: { mode: "isr", revalidate: 60 },
  landing_page: { mode: "ssg" },
  dashboard: { mode: "ssr" },
}
```

#### Theme System

A theme is an Astro project with a defined structure:

```
themes/my-theme/
├── layouts/
│   ├── default.astro       → base HTML shell
│   ├── post.astro          → single blog post
│   ├── collection.astro    → list/archive page
│   └── page.astro          → generic page
├── blocks/
│   ├── paragraph.astro     → renders Portable Text paragraph block
│   ├── image.astro         → renders image block
│   ├── embed.astro         → renders embed block
│   └── callout.astro       → renders callout block
├── components/
│   ├── Header.astro
│   ├── Footer.astro
│   └── SearchBar.tsx       → React island (interactive)
├── styles/
│   └── global.css
└── theme.config.ts
```

**Block-to-component mapping:** The renderer walks the Portable Text JSON and renders each block via the matching Astro component from the theme's `blocks/` directory.

**Theme settings:** Theme authors define customizable options (colors, layout toggles, logo) in `theme.config.ts`. These surface in the admin as a visual customizer panel. Non-technical users change settings without touching code.

**Component registry (for future visual site builder):**

```typescript
export const heroSection = defineComponent({
  name: "hero",
  label: "Hero Section",
  category: "sections",
  props: {
    headline: { type: "text", default: "Welcome" },
    subheadline: { type: "text" },
    backgroundImage: { type: "media" },
    cta: { type: "group", fields: {
      label: { type: "text" },
      url: { type: "text" },
    }},
  },
  component: HeroSection,
})
```

Developers define components; editors assemble pages from them. Design system enforced by architecture.

#### Channel Rendering

Same Portable Text content renders differently per channel:

| Channel | Output | Use case |
|---|---|---|
| **Web** | Full HTML via Astro components | Public site pages |
| **Email** | MJML-based email-safe HTML | Newsletter delivery |
| **RSS** | XML feed with basic HTML subset | Feed readers |
| **JSON** | Raw Portable Text blocks | API consumers, mobile apps |

Each channel has its own block renderer registry. When a post is published, all channel variants can be pre-rendered.

#### Asset Pipeline

```
Upload → Original stored (filesystem / S3 / R2)
           ├── Responsive variants (640, 768, 1024, 1280, 1536)
           ├── Format conversion (WebP, AVIF + original)
           ├── Blur placeholder (base64 LQIP)
           └── Metadata extracted (dimensions, EXIF, dominant color)
```

Theme components use an `<Image>` helper that outputs optimized `<picture>` tags with srcset, format negotiation, and lazy loading automatically.

---

### `packages/cli` — Developer Tooling

```
not-a-cms init [template]       Create a new project
not-a-cms dev                   Start dev server (admin + site + Y.js collab)
not-a-cms build                 Production build
not-a-cms preview               Preview production build locally

not-a-cms generate types        Regenerate TypeScript types from schema
not-a-cms generate migration    Create migration from schema changes

not-a-cms migrate               Run pending migrations
not-a-cms migrate status        Show migration state
not-a-cms migrate rollback      Revert last migration

not-a-cms seed                  Run seed file (dev data)
not-a-cms studio                Open admin UI (alias for dev)

not-a-cms extension create      Scaffold a new extension
not-a-cms theme create          Scaffold a new theme

not-a-cms deploy [target]       Deploy (Docker, Fly.io, Railway, VPS)
```

#### Project Config

```typescript
// not-a-cms.config.ts
import { defineConfig } from "@not-a-cms/core"
import { blogPost } from "./collections/blog-post"
import { page } from "./collections/page"
import { category } from "./collections/category"

export default defineConfig({
  site: {
    name: "My Site",
    url: "https://mysite.com",
  },
  database: {
    provider: "sqlite",           // or "postgres"
    url: process.env.DATABASE_URL,
  },
  storage: {
    provider: "local",            // or "s3", "r2"
    path: "./uploads",
  },
  auth: {
    methods: ["passkey", "magic-link", "oauth"],
    oauth: {
      github: { clientId: "...", clientSecret: "..." },
      google: { clientId: "...", clientSecret: "..." },
    },
    magicLink: {
      from: "login@mysite.com",
    },
  },
  collections: [blogPost, page, category],
  extensions: [],
  rendering: {
    blog_post: { mode: "isr", revalidate: 60 },
    page: { mode: "ssg" },
  },
})
```

#### Dev Workflow

```bash
bunx not-a-cms init my-blog --template blog
cd my-blog
bun install
bun run dev

# Admin:    http://localhost:4321/admin
# Site:     http://localhost:4321
# API:      http://localhost:4321/api
# GraphQL:  http://localhost:4321/graphql
# Collab:   ws://localhost:4321/collab
```

Everything hot-reloads: schema changes regenerate types and update admin, theme edits reload the site via Astro HMR, content edits update live preview via Y.js.

#### Deployment Targets

```bash
bunx not-a-cms deploy docker    # Dockerfile + docker-compose.yml
bunx not-a-cms deploy fly       # fly.toml + Postgres provisioning
bunx not-a-cms deploy railway   # railway.json
bunx not-a-cms deploy vps       # builds, copies, sets up systemd
bunx not-a-cms build --static   # SSG-only → deploy to any static host
```

---

## Authentication

**Passwordless only.** No password field, no password reset flow, no credential stuffing attack surface.

### Auth Methods

| Method | Description | When used |
|---|---|---|
| **Passkey / WebAuthn** | Biometric or hardware key. Phishing-resistant, fastest login. | Primary — prompted after first magic link login |
| **Magic Link** | Email a one-time login link. Universal fallback. | First login, passkey-unsupported devices |
| **OAuth** | GitHub, Google, configurable providers. | Developer convenience, team SSO |
| **API Keys** | Scoped, expiring tokens for machine access. | Headless consumers, automation, CI/CD |

### First-Time Setup

1. `not-a-cms init` prompts for owner email
2. System sends magic link
3. Owner logs in, prompted to register a passkey
4. Subsequent logins: tap passkey (instant) or request magic link (fallback)

### Powered by Better Auth

Better Auth is self-hosted, TypeScript-native, and stores sessions in the existing Drizzle-managed database. No external auth service dependency.

---

## Roles & Permissions

### Built-in Roles

| Role | Capabilities |
|---|---|
| **Owner** | Everything. Manage users, themes, settings. One per site. |
| **Admin** | Everything except ownership transfer. |
| **Editor** | Create, edit, publish any content. Manage media. Cannot change schema or users. |
| **Author** | Create and edit own content. Submit for review. Cannot publish. |
| **Viewer** | Read-only admin access. |

### Collection-Level Overrides

```typescript
defineRole({
  name: "marketing",
  base: "author",
  overrides: {
    landing_page: { publish: true, delete: true },
    blog_post: { publish: false },
    product: { read: false },
  },
})
```

### Field-Level Permissions

```typescript
layout: field.select(["single", "sidebar", "full-width"], {
  access: { write: ["admin", "editor"] },  // authors can't change layout
}),
customCSS: field.code({ language: "css",
  access: { write: ["admin"] },             // only admins touch CSS
}),
```

This implements Content Mode vs Design Mode — not a separate UI, but the same UI with fields hidden or locked based on role.

### API Key Scoping

```typescript
const key = await createAPIKey({
  name: "Mobile app — read only",
  permissions: {
    blog_post: ["read"],
    media: ["read"],
  },
  rateLimit: { requests: 1000, window: "1h" },
  expiresAt: "2027-01-01",
})
// Returns: nacms_live_abc123...
```

---

## Extension System

Three extension surfaces for the first milestone:

### 1. Content Hooks

Server-side lifecycle events:

```typescript
import { defineExtension } from "@not-a-cms/core"

export default defineExtension({
  name: "auto-tweet",
  hooks: {
    "content:afterPublish": async ({ collection, document, ctx }) => {
      if (collection === "blog_post") {
        await ctx.fetch("https://api.twitter.com/2/tweets", {
          method: "POST",
          body: JSON.stringify({
            text: `New post: ${document.title} — ${document.url}`,
          }),
        })
      }
    },
  },
})
```

**Available hooks:**

- `content:beforeSave` — validate, transform, enrich
- `content:afterSave` — cache invalidation, search indexing
- `content:beforePublish` — approval checks, scheduling
- `content:afterPublish` — webhooks, newsletters, social, rebuild triggers
- `content:beforeDelete` — cleanup, reference checking
- `content:afterDelete` — cache purge
- `media:afterUpload` — image optimization, metadata extraction
- `auth:afterLogin` — audit logging
- `auth:afterSignup` — welcome email, onboarding

### 2. Custom Blocks

The `defineBlock()` API (detailed in the editor section) registers new block types with editor UI, schema, and Portable Text output. Blocks appear in the slash command menu automatically.

### 3. Admin UI Panels

```typescript
import { defineAdminPanel } from "@not-a-cms/admin"

export default defineAdminPanel({
  name: "analytics",
  label: "Analytics",
  icon: "bar-chart",
  position: "sidebar",
  component: AnalyticsPanel,
})
```

Extensions can add sidebar nav items, dashboard widgets, or settings pages.

### Extension Loading

```typescript
// not-a-cms.config.ts
import autoTweet from "./extensions/auto-tweet"
import { seoFields } from "@not-a-cms/ext-seo"

export default defineConfig({
  extensions: [autoTweet, seoFields],
})
```

Extensions are TypeScript modules — imported, version-controlled, type-checked. No runtime plugin installation from an admin UI (that's a future milestone with sandboxing).

---

## Future Milestones (out of scope for M1, documented for context)

| Milestone | Scope |
|---|---|
| **M2: Visual Site Builder** | Drag-and-drop page assembly from registered components, visual CSS editor, grid positioning |
| **M3: Channel Rendering** | Email newsletter delivery, RSS generation, multi-channel preview in editor |
| **M4: Visual Automations** | Event-driven automation builder UI (Directus Flows-style) |
| **M5: Membership & Paywall** | Free/paid tiers, subscriber management, gated content |
| **M6: Plugin Marketplace** | npm-based distribution, sandboxed execution, admin UI installation |
| **M7: AI Infrastructure** | AI writing assistance, content generation, translation, MCP server |

---

## Competitive Positioning

| Feature | WordPress | EmDash | Ghost | Payload | not-a-cms |
|---|---|---|---|---|---|
| Content storage | HTML string | Portable Text | Mobiledoc | Lexical JSON | Portable Text |
| Schema model | wp_posts mega-table | Per-type tables | Fixed (posts only) | Code-first collections | Code-first + visual builder |
| Editor | Gutenberg (controversial) | Tiptap | Koenig (React) | Lexical | Tiptap + Y.js collab |
| Real-time collab | No | Durable Objects (CF only) | No | No | Y.js CRDTs (universal) |
| Auth | Password-based | Passkey-only | Password + magic link | Custom | Passwordless (passkey + magic link + OAuth) |
| API | REST + WPGraphQL plugin | REST | REST + GraphQL | REST + GraphQL | tRPC + REST + GraphQL |
| Self-hosted | Yes (PHP + MySQL) | Yes (CF Workers or Node) | Yes (Node + MySQL) | Yes (Next.js + Postgres) | Yes (Bun + SQLite/Postgres) |
| Framework coupling | PHP | Astro + Cloudflare | Node/Express | Next.js | Astro (not coupled to a cloud provider) |
| Offline editing | No | No | No | No | Yes (Y.js IndexedDB) |
| Plugin isolation | None (shared PHP) | V8 isolates (CF paid only) | None | None | Future milestone |

---

## Key Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Runtime | Bun | Fastest JS runtime, built-in SQLite/WebSocket/.env, TypeScript-native |
| Framework | Astro | Content-first, island architecture, zero JS default, not coupled to one cloud |
| Editor engine | Tiptap/ProseMirror | Most extensible, schema-typed, best React/Y.js integration |
| Collaboration | Y.js CRDTs | Offline support, character-level merge, proven at scale (Notion uses it) |
| Database access | Drizzle ORM | TypeScript-first, SQLite + Postgres, auto-migration generation |
| Content format | Portable Text (JSON) | Channel-agnostic, queryable, renderable per destination |
| Internal API | tRPC | Zero-overhead typed calls between our own packages |
| External API | REST + GraphQL | REST for integrations, GraphQL for headless frontend devs |
| Auth | Better Auth (passwordless) | Self-hosted, TypeScript-native, no passwords in the system |
| Monorepo tool | Turborepo | Fast, caching, works with Bun workspaces |
| Not Convex | DIY stack | Full SQL, Bun-native, no vendor ceiling, offline support |
| Not EmDash fork | Own codebase | No Cloudflare coupling, visual builder vision, different architecture goals |
