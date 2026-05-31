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

## Ports And URLs

Development defaults:

| Surface | Default |
|---|---|
| API | `http://localhost:4321` |
| Admin | `http://localhost:4322` |
| Site renderer | `http://localhost:3000` |

Production should use externally routable HTTPS URLs in `BASE_URL`, `SITE_URL`, and `CORS_ORIGINS`.

## Generated Project Files

`not-a-cms init` creates:

- `.env` for local runtime defaults and commented production options.
- `not-a-cms.config.ts` for schema, channels, theme, storage, auth methods, and rendering rules.
- `.gitignore` that excludes secrets, local databases, and upload directories.

Do not commit `.env`, SQLite database files, upload directories, or object storage credentials.
