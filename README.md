# not-a-cms

A modern, open-source CMS built to replace WordPress. TypeScript end-to-end, passwordless by default, real-time collaborative editing, built-in visual automations, and zero vendor lock-in.

```bash
bunx not-a-cms init my-site
cd my-site && bun install && bun run dev
```

**Admin:** `http://localhost:4322` | **Site:** `http://localhost:3000` | **API:** `http://localhost:4321/api`

> **Status:** Actively developed. The content engine, visual site builder, automations, channel rendering, media library, and the collaborative admin are shipped and covered by 708 passing tests across six packages. See the [roadmap](#roadmap) for what's next.

---

## Why not-a-cms?

WordPress powers 43% of the web, but it was designed in 2003. We built not-a-cms for 2026:

| | WordPress | not-a-cms |
|---|---|---|
| **Content storage** | HTML strings in `wp_posts` | Typed JSON (Portable Text) |
| **Schema** | One mega-table for everything | Per-collection SQL tables |
| **Editor** | Gutenberg (controversial) | Tiptap + slash commands + Y.js collab |
| **Auth** | Passwords (brute-force target #1) | Passwordless magic links, optional OAuth |
| **API** | REST (+ WPGraphQL plugin) | tRPC + REST + GraphQL |
| **Runtime** | PHP | Bun (TypeScript-native) |
| **Real-time** | No | Y.js CRDTs (offline-capable) |
| **Framework** | PHP templates | Astro (zero JS by default) |
| **Automations** | Plugins + external Zapier | Built-in visual rules (WHEN / IF / THEN) |
| **Media** | Flat uploads folder | Typed library: folders, tags, usage tracking |
| **Search** | `LIKE` queries | FTS5 + optional semantic Ask |

## Core Principles

- **Passwordless only**: no passwords anywhere. Magic links ship today; OAuth is config-driven; passkeys are planned.
- **JSON over HTML**: content stored as Portable Text, rendered per channel (web, email, RSS).
- **TypeScript end-to-end**: schema defines types that flow from database to frontend.
- **Self-hosted, zero vendor lock-in**: your data, your database, deploy anywhere.
- **Real-time by default**: collaborative editing and live preview out of the box.

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.2+

### Create a Project

```bash
bunx not-a-cms init my-blog
cd my-blog
bun install
bun run dev
```

This gives you:

```
my-blog/
├── collections/
│   ├── blog-post.ts      # Blog post content type
│   └── page.ts           # Page content type
├── theme/                 # Your site's theme
├── extensions/            # Custom extensions
├── not-a-cms.config.ts    # Main configuration
├── .env                   # Secrets (auto-generated)
└── package.json
```

### Define Content Types

```typescript
// collections/blog-post.ts
import { defineCollection, field } from "@not-a-cms/core"

export const blogPost = defineCollection({
  name: "blog_post",
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    slug: field.slug({ from: "title" }),
    body: field.richText(),
    coverImage: field.media({ accept: ["image/*"] }),
    author: field.relation("user"),
    tags: field.array(field.text()),
    status: field.select(["draft", "in_review", "published", "archived"], {
      default: "draft",
    }),
    publishedAt: field.datetime(),
    seo: field.group({
      metaTitle: field.text(),
      metaDescription: field.text({ maxLength: 160 }),
    }),
  },
})
```

Each collection becomes its own SQL table with real typed columns. Rich text is stored as Portable Text JSON, never HTML.

### Field Types

| Type | Description | Storage |
|---|---|---|
| `field.text()` | Plain text | `TEXT` column |
| `field.slug()` | URL slug, auto-generated from another field | `TEXT` column |
| `field.richText()` | Portable Text document | `TEXT` (JSON) |
| `field.number()` | Integer | `INTEGER` column |
| `field.boolean()` | True/false | `INTEGER` column |
| `field.datetime()` | Date and time | `TEXT` (ISO 8601) |
| `field.select()` | Enum from a list of options | `TEXT` column |
| `field.relation()` | Foreign key to another collection | `TEXT` (ID) |
| `field.media()` | File reference | `TEXT` (ID) |
| `field.array()` | Array of any field type | `TEXT` (JSON) |
| `field.group()` | Nested field group | `TEXT` (JSON) |

---

## Configuration

```typescript
// not-a-cms.config.ts
import { defineConfig } from "@not-a-cms/core"
import { blogPost } from "./collections/blog-post"
import { page } from "./collections/page"

export default defineConfig({
  site: {
    name: "My Site",
    url: "https://mysite.com",
  },
  database: {
    provider: "sqlite",        // or "postgres"
    url: "data.db",            // or process.env.DATABASE_URL
  },
  storage: {
    provider: "local",         // or "s3", "r2"
    path: "./uploads",
  },
  // S3-compatible object storage keeps the media index local and stores
  // uploaded binaries in the configured bucket.
  // storage: {
  //   provider: "r2",
  //   path: ".media-index",
  //   bucket: process.env.S3_BUCKET,
  //   endpoint: process.env.S3_ENDPOINT,
  //   region: "auto",
  //   accessKeyId: process.env.S3_ACCESS_KEY_ID,
  //   secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  //   prefix: "uploads",
  // },
  auth: {
    methods: ["magic-link", "oauth"],
    oauth: {
      github: { clientId: "...", clientSecret: "..." },
      google: { clientId: "...", clientSecret: "..." },
    },
    magicLink: {
      from: "login@mysite.com",
    },
  },
  collections: [blogPost, page],
  extensions: [],
  rendering: {
    blog_post: { mode: "isr", revalidate: 60 },
    page: { mode: "ssg" },
  },
})
```

Storage can also be configured for the bundled dev server through environment variables:

| Variable | Purpose |
|---|---|
| `STORAGE_PROVIDER` | `local`, `s3`, or `r2` |
| `MEDIA_STORAGE_PATH` | Local upload directory for `local` storage |
| `MEDIA_INDEX_PATH` | Local media index directory for S3/R2 metadata |
| `S3_BUCKET` | Object storage bucket name |
| `S3_ENDPOINT` | S3-compatible endpoint, required for R2/minio-style providers |
| `S3_REGION` | Signing region, use `auto` for R2 |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Object storage credentials |
| `S3_PREFIX` | Optional object key prefix |

---

## API

Every collection automatically gets three API layers:

### REST (external consumers)

```bash
# List
curl http://localhost:4321/api/blog_post

# Get by ID
curl http://localhost:4321/api/blog_post/:id

# Create
curl -X POST http://localhost:4321/api/blog_post \
  -H "Content-Type: application/json" \
  -d '{"title": "Hello World", "slug": "hello-world", "status": "draft"}'

# Update
curl -X PATCH http://localhost:4321/api/blog_post/:id \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Title"}'

# Delete
curl -X DELETE http://localhost:4321/api/blog_post/:id
```

Generated OpenAPI documentation is available from the running API server:

```bash
curl http://localhost:4321/api/_docs/openapi.json
```

The document is generated from the configured collections and includes REST paths, field schemas, cookie auth requirements, and standard error responses.

### tRPC (internal, fully typed)

```typescript
const posts = await trpc.content.findMany.query({
  collection: "blog_post",
  where: { status: "published" },
  limit: 10,
})
// posts is fully typed, no casting needed
```

### GraphQL (headless frontends)

```graphql
query {
  blogPosts(where: { status: "published" }, limit: 10) {
    title
    slug
    author { name }
    tags
  }
}
```

---

## Editor

The editor is built on Tiptap v3 with real-time collaboration via Y.js.

```tsx
import { Editor } from "@not-a-cms/editor"

<Editor
  content={portableTextBlocks}
  onChange={(blocks) => save(blocks)}
  placeholder="Type / to insert, or just start writing..."
  collaboration={{
    serverUrl: "ws://localhost:4321/collab",
    documentId: "post-123",
    user: { name: "Alice", color: "#f783ac" },
  }}
/>
```

### Features

- **Slash commands**: type `/` to insert headings, lists, code blocks, callouts, dividers
- **Markdown shortcuts**: `##` for heading, `**` for bold, `>` for quote, ``` for code
- **Bubble menu**: select text to format (bold, italic, code, link, headings)
- **Real-time collaboration**: Y.js CRDTs with live cursors, offline support, character-level merge
- **Custom blocks**: extend the editor with your own block types

### Custom Blocks

```typescript
import { defineBlock } from "@not-a-cms/editor"

const pricingTable = defineBlock({
  name: "pricing-table",
  label: "Pricing Table",
  icon: "dollar-sign",
  group: "commerce",
  schema: {
    plans: { type: "text", default: "" },
  },
  editor: PricingTableEditor,  // React component
  toPortableText: (data) => ({ type: "pricing-table", ...data }),
})
```

Custom blocks appear in the slash command menu automatically.

---

## Admin

The admin is a single Astro app with React islands, driven entirely by your schema: add a field and every screen updates. It runs on `http://localhost:4322`.

- **Command Deck**: a `⌘K` palette to jump to any collection or document, run actions, search content, and ask questions in natural language.
- **Document editor**: a focused writing canvas built on the Tiptap editor, with inline field blocks (author, gallery, SEO), version history with restore, preview links, and a live channel mirror showing how a post renders to web and email.
- **Dashboard**: a publishing horizon (what's scheduled, what's about to expire) and a "needs you" queue (content in review, failed automation runs, who's editing live right now).
- **The Vault**: a media library that clusters assets by type, surfaces unused files, and supports folders, tags, bulk tagging and moving, and reverse usage lookup (which documents reference each asset).
- **Automations**: a visual rule editor and run console (see below).
- **Settings**: theme customizer, roles and access control, channels, webhooks, and team invites.

---

## Automations

Replace Zapier for content workflows: rules run inside the CMS, with no external service required. A rule reads as **WHEN** a trigger fires, **IF** conditions match, **THEN** run actions.

```typescript
// Authored in the admin, stored in the database
{
  name: "Notify on publish",
  trigger: { type: "content.published", collection: "blog_post" },
  conditions: { all: [{ field: "status", op: "eq", value: "published" }] },
  actions: [
    { type: "action.webhook", url: "https://api.example.com/notify", method: "POST" },
    { type: "action.email", to: "team@example.com", subject: "New post is live" },
  ],
}
```

| Stage | Options |
|---|---|
| **Triggers** | `content.created`, `content.updated`, `content.published`, `content.deleted`, `schedule.cron`, `webhook.received` |
| **Conditions** | `eq`, `neq`, `gt`, `lt`, `contains`, `not_contains`, `matches` (combined with `all` / `any`) |
| **Actions** | create / update / delete content, send email, call a webhook, transform data, log |

Every rule has a **Test** button that runs a dry-run: the engine walks the whole flow and records each step *without performing any side effects*, so you can see exactly what would happen before enabling it. The run console shows live run history with a step-by-step timeline, per-step timing, and statuses (`running`, `completed`, `failed`, `skipped`).

---

## Search & AI

Full-text search is built in: every collection is indexed with SQLite FTS5 (porter stemmer), and is exposed through the admin search bar, the Command Deck, and a REST `?search=` parameter.

**Natural-language Ask** sits on top. With no configuration it answers questions by ranking full-text results. Configure an `AskProvider` (opt-in OpenAI or Anthropic adapters, with no AI dependency added to core) and it switches to semantic search over content embeddings, falling back to full-text whenever no provider is set. Vector search is served by a `sqlite-vec` ANN index (a derived `vec0` table, auto-detected at boot) so it scales beyond small catalogs, with a transparent fallback to in-memory cosine when the extension is unavailable.

```bash
curl "http://localhost:4321/api/_ask?q=posts%20about%20our%20pricing%20change"
```

---

## Publishing Workflow

Content moves through `draft → in_review → published → archived`. Set `publishedAt` to a future time and a post publishes itself on schedule; set an optional `unpublishAt` and it auto-archives when it expires. A 60-second scheduler tick promotes due posts and retires expired ones, and the dashboard surfaces both horizons so nothing slips.

---

## Portable Text

Content is stored as Portable Text: a typed JSON array, not HTML. This means the same content can render to web, email, RSS, or native apps.

```json
[
  {
    "type": "heading",
    "level": 2,
    "children": [{ "type": "text", "value": "Hello World" }]
  },
  {
    "type": "paragraph",
    "children": [
      { "type": "text", "value": "This is " },
      { "type": "text", "value": "bold", "marks": ["bold"] },
      { "type": "text", "value": " text." }
    ]
  },
  {
    "type": "callout",
    "variant": "warning",
    "children": [{ "type": "text", "value": "Important note" }]
  }
]
```

### Serialization

```typescript
import { toPortableText, fromPortableText } from "@not-a-cms/editor"

// Tiptap JSON → Portable Text (for storage)
const pt = toPortableText(editor.getJSON())

// Portable Text → Tiptap JSON (for editing)
const tiptap = fromPortableText(storedContent)
```

### Channel Rendering

```typescript
import { portableTextToHtml, renderRSSFeed } from "@not-a-cms/renderer"

// Portable Text → HTML (for RSS descriptions)
const html = portableTextToHtml(blocks)

// Full RSS feed
const xml = renderRSSFeed(
  { title: "My Blog", description: "...", siteUrl: "https://mysite.com" },
  items,
)
```

---

## Themes

Themes are Astro projects with a defined structure:

```
theme/
├── layouts/
│   └── default.astro       # Base HTML shell
├── blocks/
│   ├── paragraph.astro      # Renders paragraph PT blocks
│   ├── heading.astro        # Renders heading PT blocks
│   ├── callout.astro        # Renders callout PT blocks
│   └── ...                  # One per block type
├── components/
│   ├── Header.astro
│   └── Footer.astro
├── styles/
│   └── global.css
└── theme.config.ts
```

### Theme Configuration

```typescript
import { defineTheme } from "@not-a-cms/renderer"

export default defineTheme({
  name: "starter-blog",
  version: "1.0.0",
  settings: {
    colors: {
      primary: { type: "color", default: "#2563eb", label: "Primary Color" },
      background: { type: "color", default: "#ffffff", label: "Background" },
    },
    layout: {
      maxWidth: { type: "select", options: ["narrow", "medium", "wide"], default: "medium" },
    },
  },
})
```

Settings surface in the admin as a visual customizer panel.

### Rendering Modes

| Mode | Behavior | Best for |
|---|---|---|
| **SSG** | Pre-built at deploy time | Blogs, docs, marketing |
| **SSR** | Rendered per request | Dynamic, personalized |
| **ISR** | Cached, background rebuild | High-traffic + fresh |

---

## Authentication

Passwordless only. No password field exists anywhere in the system. Magic links are always enabled, and GitHub/Google OAuth buttons appear on the admin login screen when their provider credentials are configured. Passkey/WebAuthn support is planned, but it is not exposed in the UI until the server plugin, database tables, and client registration flow are wired end to end.

| Method | Description |
|---|---|
| **Magic Link** | One-time email link (universal fallback) |
| **OAuth** | GitHub and Google when configured |
| **Passkey / WebAuthn** | Planned |
| **API Keys** | Planned scoped, expiring tokens for headless/machine access |

### Roles

| Role | Can do |
|---|---|
| **Owner** | Everything |
| **Admin** | Everything except ownership transfer |
| **Editor** | Create, edit, publish any content |
| **Author** | Create and edit own content, submit for review |
| **Viewer** | Read-only admin access |

Roles support collection-level and field-level overrides for fine-grained access control.

---

## CLI

```bash
not-a-cms init [name]              # Scaffold a new project
not-a-cms dev [--port=4321]        # Start API, admin, and renderer
not-a-cms build [--static]         # Production build
not-a-cms generate types           # Show schema type info
not-a-cms generate migration       # Generate SQL migration
not-a-cms migrate                  # Run pending migrations
not-a-cms migrate status           # Check migration state
not-a-cms import wordpress <file>  # Import from a WordPress WXR export
not-a-cms export                   # Export all collections as JSON
```

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  @not-a-cms/admin          Astro + React islands     │
│  Dashboard, content list, editor, media library      │
├──────────────────────────────────────────────────────┤
│  @not-a-cms/editor         Tiptap v3 + Y.js          │
│  Slash commands, bubble menu, Portable Text, collab  │
├──────────────────────────────────────────────────────┤
│  @not-a-cms/server         Bun.serve()               │
│  tRPC + REST + GraphQL + WebSocket + Better Auth     │
├──────────────────────────────────────────────────────┤
│  @not-a-cms/core           Pure TypeScript            │
│  Schema engine, Drizzle ORM, content CRUD + hooks    │
├──────────────────────────────────────────────────────┤
│  @not-a-cms/renderer       Astro SSR/SSG/ISR         │
│  Theme system, block rendering, RSS/JSON channels    │
├──────────────────────────────────────────────────────┤
│  @not-a-cms/cli            Bun CLI                    │
│  init, dev, build, migrate, generate                 │
└──────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| Framework | Astro 5 |
| Editor | Tiptap v3 (ProseMirror) |
| Real-time | Y.js (CRDT) |
| Database | Drizzle ORM (SQLite / PostgreSQL) |
| Auth | Better Auth (passwordless) |
| Internal API | tRPC |
| External API | REST + GraphQL |
| Styling | Tailwind CSS |
| Build | Turborepo |

---

## Extensions

Three extension surfaces:

### Content Hooks

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
            text: `New post: ${document.title} (${document.url})`,
          }),
        })
      }
    },
  },
})
```

Available hooks: `content:beforeSave`, `content:afterSave`, `content:beforePublish`, `content:afterPublish`, `content:beforeDelete`, `content:afterDelete`, `media:afterUpload`, `auth:afterLogin`, `auth:afterSignup`

### Custom Editor Blocks

Use `defineBlock()` to add new block types to the editor (see Editor section above).

### Admin UI Panels

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

---

## Deployment

The production runtime is a Bun server with three deployable surfaces: the API server, the admin Astro app, and the public renderer Astro app. Start with:

- [Deployment guide](docs/deployment.md) for Bun, Docker, reverse proxy, CORS, storage, and backups.
- [Configuration reference](docs/configuration.md) for required environment variables and config file fields.
- [Security checklist](docs/security.md) for secrets, auth, TLS, media, roles, and operations.

Minimum production environment:

```bash
PORT=4321
BASE_URL=https://cms.example.com
CORS_ORIGINS=https://admin.example.com,https://www.example.com
DATABASE_URL=/var/lib/not-a-cms/data.db
BETTER_AUTH_SECRET=<64+ random characters>
MEDIA_STORAGE_PATH=/var/lib/not-a-cms/uploads
```

Then build and run:

```bash
bun install --frozen-lockfile
bun run build
bun ./dist/not-a-cms.config.js
```

The server runs on Bun, so any host that supports Bun or Docker works. Put it behind HTTPS before accepting real logins.

---

## Development

```bash
# Clone and install
git clone https://github.com/your-org/not-a-cms.git
cd not-a-cms
bun install

# Run tests
bun run test

# Start dev
bun run dev
```

### Monorepo Structure

```
not-a-cms/
├── packages/
│   ├── core/        # Schema, DB, content CRUD, automations, search/AI
│   ├── editor/      # Tiptap editor, blocks, collaboration
│   ├── admin/       # Astro admin app (command deck, editor, vault)
│   ├── server/      # HTTP server, APIs, auth, collab, automations
│   ├── renderer/    # Public site rendering, themes, channels
│   └── cli/         # Developer CLI
├── docs/            # Guides, specs, and backlog
├── turbo.json       # Turborepo config
└── package.json     # Bun workspace root
```

---

## Roadmap

**Shipped**

- [x] **Content Engine**: schema, Tiptap editor, REST/tRPC/GraphQL APIs, passwordless auth, admin, renderer, CLI
- [x] **Production Essentials**: versioning, full-text search, migrations, image optimization, RSS, Docker/Fly deployment
- [x] **Differentiators**: GraphQL, webhooks, scheduled publishing, preview links, role-based field access, theme customizer, email rendering, WordPress import
- [x] **Visual Site Builder**: drag-and-drop page canvas, visual CSS editor, free grid positioning, responsive breakpoints
- [x] **Visual Automations**: event-driven rules (WHEN / IF / THEN), run console, dry-run testing, content/email/webhook actions
- [x] **Collaborative Admin**: Command Deck, document editor with live channel mirror, dashboard horizons, media Vault (folders, tags, usage)
- [x] **Real-time**: Y.js collaboration with live presence and per-caret cursors
- [x] **Natural-language Ask**: semantic search (sqlite-vec ANN index with in-memory cosine fallback) with a pluggable AI provider and full-text fallback

**Next**

- [ ] **Channels**: newsletter delivery to subscribers, multi-channel preview
- [ ] **Membership & Paywall**: paid tiers, subscriber management, Stripe
- [ ] **Plugin Marketplace**: npm distribution, sandboxed execution
- [ ] **AI Infrastructure**: MCP server, in-editor writing assistant, content generation

See [`MILESTONES.md`](MILESTONES.md) for the detailed phase log, planned phases, and deferred enhancements.

---

## License

MIT
