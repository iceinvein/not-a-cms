# Configuration

not-a-cms reads project configuration from `not-a-cms.config.ts` and runtime secrets from environment variables. Keep deploy-specific values in the environment so the same code can run in development, staging, and production.

## Required Environment Variables

| Variable | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes | SQLite file path used by the server. |
| `BETTER_AUTH_SECRET` | Yes | Secret used to sign auth state. Use 64+ random characters. |
| `BASE_URL` | Yes in production | Public API origin used by auth callbacks and links. |
| `CORS_ORIGINS` | Yes in production | Comma-separated list of admin/site origins allowed to make credentialed API requests. |
| `PORT` | No | API server port. Defaults to `4321`. |
| `MEDIA_STORAGE_PATH` | For local storage | Directory for uploaded files. |
| `MEDIA_INDEX_PATH` | For S3/R2 | Directory for media metadata/index files. |

## Optional Authentication Variables

OAuth buttons appear when the matching provider credentials are present.

| Variable | Purpose |
|---|---|
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Enable GitHub OAuth. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Enable Google OAuth. |

Magic-link login is always available. The current development server logs magic links to stdout; production deployments should wire email delivery before inviting real users.

## Storage Variables

| Variable | Purpose |
|---|---|
| `STORAGE_PROVIDER` | `local`, `s3`, or `r2`. |
| `MEDIA_STORAGE_PATH` | Local upload directory. |
| `MEDIA_INDEX_PATH` | Local metadata/index directory for S3/R2 records. |
| `S3_BUCKET` | Bucket name. |
| `S3_ENDPOINT` | S3-compatible endpoint. Required for R2 and MinIO-style providers. |
| `S3_REGION` | Signing region. Use `auto` for R2. |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Object storage credentials. |
| `S3_PUBLIC_URL` | Optional public media base URL. |
| `S3_PREFIX` | Optional object key prefix, such as `uploads`. |

## Project Config

Example production-aware config:

```typescript
import { defineConfig } from "@not-a-cms/core"
import { blogPost } from "./collections/blog-post"
import { page } from "./collections/page"

export default defineConfig({
  site: {
    name: "My Site",
    url: process.env.SITE_URL ?? "http://localhost:3000",
  },
  database: {
    provider: "sqlite",
    url: process.env.DATABASE_URL ?? "data.db",
  },
  storage: {
    provider: "local",
    path: process.env.MEDIA_STORAGE_PATH ?? "./uploads",
  },
  auth: {
    methods: ["magic-link", "oauth"],
    magicLink: {
      from: process.env.MAGIC_LINK_FROM ?? "login@example.com",
    },
  },
  collections: [blogPost, page],
  rendering: {
    blog_post: { mode: "isr", revalidate: 60 },
    page: { mode: "ssg" },
  },
})
```

For S3/R2 storage:

```typescript
storage: {
  provider: "r2",
  path: process.env.MEDIA_INDEX_PATH ?? ".media-index",
  bucket: process.env.S3_BUCKET,
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "auto",
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  publicUrl: process.env.S3_PUBLIC_URL,
  prefix: process.env.S3_PREFIX ?? "uploads",
}
```

## Site Identity

The public renderer builds its header, footer, and branding from the `site` block, which the server exposes to the renderer at `GET /api/_site`. Everything here is optional; omit it and the renderer falls back to minimal default chrome.

```typescript
site: {
  name: "My Site",
  url: "https://mysite.com",
  nav: {
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "Blog", href: "/blog" },
      { label: "GitHub", href: "https://github.com/your-org/repo", external: true },
    ],
    cta: { label: "Get started", href: "/pricing" },
  },
  footer: {
    tagline: "One line about the site.",
    columns: [
      { heading: "Product", links: [{ label: "Pricing", href: "/pricing" }] },
      { heading: "Company", links: [{ label: "About", href: "/about" }] },
    ],
    social: [{ label: "GitHub", href: "https://github.com/your-org/repo" }],
    legal: "© 2026 My Site",
  },
}
```

| Field | Purpose |
|---|---|
| `site.name` | Site title used in chrome and metadata. |
| `site.url` | Canonical public origin. |
| `site.nav.links` | Header navigation links. Set `external: true` for off-site links. |
| `site.nav.cta` | Optional highlighted call-to-action button in the header. |
| `site.footer.tagline` | Short line shown in the footer. |
| `site.footer.columns` | Grouped footer link columns (`heading` plus `links`). |
| `site.footer.social` | Social links row. |
| `site.footer.legal` | Copyright or legal line. |

## Custom Routes

By default each collection is served under its own path. Use `routes` to mount a collection at a custom URL pattern, so a `project` collection can render case-study pages at `/work/:slug`:

```typescript
routes: [
  { collection: "project", path: "/work/:slug" },
],
```

| Field | Purpose |
|---|---|
| `collection` | Collection name to route. |
| `path` | URL pattern; `:slug` is filled from the document slug. |
| `slug` | Optional field name to use as the slug (defaults to the collection's slug field). |

Custom routes are published to the renderer through `GET /api/_site`.

## Theme

`theme` drives the public renderer's design tokens (colors, fonts, spacing) and is served to the renderer at `GET /api/_theme`. Light and dark identities are both expressible from config alone.

```typescript
theme: {
  name: "my-theme",
  version: "1.0.0",
  settings: {
    colors: { accent: { default: "#c2410c" } },
  },
}
```

## Channels

Optional per-channel metadata for RSS and email rendering:

```typescript
channels: {
  rss: {
    title: "My Blog",
    description: "Latest posts",
    collection: "blog_post",
    itemPath: "/blog/:slug",
  },
  email: {
    fromName: "My Site",
    subjectPrefix: "[My Site] ",
    footerText: "You are receiving this because you subscribed.",
  },
}
```

## Ports And URLs

Development defaults:

| Surface | Default |
|---|---|
| API | `http://localhost:4321` |
| Admin | `http://localhost:4322` |
| Site renderer | `http://localhost:3000` |

Production should use externally routable HTTPS URLs in `BASE_URL`, `SITE_URL`, and `CORS_ORIGINS`.

The dev orchestrator (`scripts/dev.ts`) accepts per-surface port flags, each with an environment-variable fallback:

| Flag | Env fallback | Default |
|---|---|---|
| `--port` | `PORT` | `4321` (API) |
| `--admin-port` | `ADMIN_PORT` | `4322` (admin) |
| `--renderer-port` | `RENDERER_PORT` | `3000` (site renderer) |

## Selecting The Project Config

The server loads its config through `loadConfig`, which reads `not-a-cms.config.ts` from the current directory by default. Point it elsewhere with `CONFIG_PATH`:

| Variable | Purpose |
|---|---|
| `CONFIG_PATH` | Absolute or relative path to the `not-a-cms.config.ts` to load. |

The dev orchestrator also takes a `--site=<name>` flag (or the `SITE` env var), which resolves to `dogfood-sites/<name>/not-a-cms.config.ts` and sets `CONFIG_PATH` for you. This is how the two bundled example sites run on the one engine:

```bash
bun scripts/dev.ts --site=not-a-cms                       # warm marketing site
bun scripts/dev.ts --site=studio --renderer-port=3001     # dark studio site (alt port)
```

An explicit `--site` wins over `SITE`, which wins over an existing `CONFIG_PATH`. See `dogfood-sites/README.md` for the full example-site walkthrough.

## Generated Project Files

`not-a-cms init` creates:

- `.env` for local runtime defaults and commented production options.
- `not-a-cms.config.ts` for schema, channels, theme, storage, auth methods, and rendering rules.
- `.gitignore` that excludes secrets, local databases, and upload directories.

Do not commit `.env`, SQLite database files, upload directories, or object storage credentials.
