# not-a-cms

A modern, open-source CMS built to replace WordPress. TypeScript end-to-end, passwordless by default, real-time collaborative editing, and zero vendor lock-in.

```bash
bunx not-a-cms init my-site
cd my-site && bun install && bun run dev
```

**Admin:** `http://localhost:4321/admin` | **Site:** `http://localhost:4321` | **API:** `http://localhost:4321/api`

---

## Why not-a-cms?

WordPress powers 43% of the web — but it was designed in 2003. We built not-a-cms for 2026:

| | WordPress | not-a-cms |
|---|---|---|
| **Content storage** | HTML strings in `wp_posts` | Typed JSON (Portable Text) |
| **Schema** | One mega-table for everything | Per-collection SQL tables |
| **Editor** | Gutenberg (controversial) | Tiptap + slash commands + Y.js collab |
| **Auth** | Passwords (brute-force target #1) | Passwordless (passkey + magic link) |
| **API** | REST (+ WPGraphQL plugin) | tRPC + REST + GraphQL |
| **Runtime** | PHP | Bun (TypeScript-native) |
| **Real-time** | No | Y.js CRDTs (offline-capable) |
| **Framework** | PHP templates | Astro (zero JS by default) |

## Core Principles

- **Passwordless only** — no passwords anywhere. Passkeys, magic links, OAuth.
- **JSON over HTML** — content stored as Portable Text, rendered per channel (web, email, RSS).
- **TypeScript end-to-end** — schema defines types that flow from database to frontend.
- **Self-hosted, zero vendor lock-in** — your data, your database, deploy anywhere.
- **Real-time by default** — collaborative editing and live preview out of the box.

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
    status: field.select(["draft", "published", "archived"], {
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

Each collection becomes its own SQL table with real typed columns. Rich text is stored as Portable Text JSON — never HTML.

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
  auth: {
    methods: ["passkey", "magic-link", "oauth"],
    oauth: {
      github: { clientId: "...", clientSecret: "..." },
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

### tRPC (internal, fully typed)

```typescript
const posts = await trpc.content.findMany.query({
  collection: "blog_post",
  where: { status: "published" },
  limit: 10,
})
// posts is fully typed — no casting needed
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

- **Slash commands** — type `/` to insert headings, lists, code blocks, callouts, dividers
- **Markdown shortcuts** — `##` for heading, `**` for bold, `>` for quote, ``` for code
- **Bubble menu** — select text to format (bold, italic, code, link, headings)
- **Real-time collaboration** — Y.js CRDTs with live cursors, offline support, character-level merge
- **Custom blocks** — extend the editor with your own block types

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

## Portable Text

Content is stored as Portable Text — a typed JSON array, not HTML. This means the same content can render to web, email, RSS, or native apps.

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

Passwordless only. No password field exists anywhere in the system.

| Method | Description |
|---|---|
| **Passkey / WebAuthn** | Biometric or hardware key (primary, phishing-resistant) |
| **Magic Link** | One-time email link (universal fallback) |
| **OAuth** | GitHub, Google, configurable |
| **API Keys** | Scoped, expiring tokens for headless/machine access |

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
not-a-cms dev [--port=4321]        # Start dev server
not-a-cms build [--static]         # Production build
not-a-cms generate types           # Show schema type info
not-a-cms generate migration       # Generate SQL migration
not-a-cms migrate                  # Run pending migrations
not-a-cms migrate status           # Check migration state
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
            text: `New post: ${document.title} — ${document.url}`,
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

```bash
# Docker
not-a-cms build && docker build -t my-site .

# Fly.io
fly launch

# Any VPS
not-a-cms build
scp -r dist/ user@server:/app/
```

The server runs on Bun — any host that supports Bun or Docker works.

---

## Development

```bash
# Clone and install
git clone https://github.com/your-org/not-a-cms.git
cd not-a-cms
bun install

# Run tests (134 tests across 6 packages)
bun run test

# Start dev
bun run dev
```

### Monorepo Structure

```
not-a-cms/
├── packages/
│   ├── core/        # Schema engine, DB, content CRUD
│   ├── editor/      # Tiptap editor, blocks, collaboration
│   ├── admin/       # Astro admin panel
│   ├── server/      # HTTP server, APIs, auth
│   ├── renderer/    # Public site rendering, themes
│   └── cli/         # Developer CLI
├── docs/            # Design specs and plans
├── turbo.json       # Turborepo config
└── package.json     # Bun workspace root
```

---

## Roadmap

- [x] **M1: Content Engine** — Schema, editor, APIs, auth, admin, renderer, CLI
- [ ] **M2: Visual Site Builder** — Drag-and-drop page assembly, visual CSS editor
- [ ] **M3: Channel Rendering** — Email newsletters, multi-channel preview
- [ ] **M4: Visual Automations** — Event-driven automation builder
- [ ] **M5: Membership & Paywall** — Paid tiers, subscriber management
- [ ] **M6: Plugin Marketplace** — npm distribution, sandboxed execution
- [ ] **M7: AI Infrastructure** — Writing assistance, content generation, MCP server

---

## License

MIT
