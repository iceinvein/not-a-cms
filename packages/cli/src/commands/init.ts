import { registerCommand } from "../router"
import { join } from "node:path"
import { mkdirSync, writeFileSync, existsSync } from "node:fs"

registerCommand({
  name: "init",
  description: "Create a new not-a-cms project",
  async run(args) {
    const projectName = args[0] || "my-site"
    const template = args.find((a) => a.startsWith("--template="))?.split("=")[1] || "blog"
    const projectDir = join(process.cwd(), projectName)

    if (existsSync(projectDir)) {
      console.error(`Directory '${projectName}' already exists`)
      process.exit(1)
    }

    console.log(`Creating not-a-cms project: ${projectName}`)

    // Create directory structure
    const dirs = [
      "",
      "collections",
      "theme",
      "theme/layouts",
      "theme/blocks",
      "theme/components",
      "theme/styles",
      "public",
      "extensions",
    ]

    for (const dir of dirs) {
      mkdirSync(join(projectDir, dir), { recursive: true })
    }

    // package.json
    writeFileSync(
      join(projectDir, "package.json"),
      JSON.stringify(
        {
          name: projectName,
          private: true,
          type: "module",
          scripts: {
            dev: "not-a-cms dev",
            build: "not-a-cms build",
          },
          dependencies: {
            "@not-a-cms/core": "latest",
            "@not-a-cms/server": "latest",
            "@not-a-cms/editor": "latest",
            "@not-a-cms/admin": "latest",
            "@not-a-cms/renderer": "latest",
            "@not-a-cms/cli": "latest",
          },
        },
        null,
        2,
      ) + "\n",
    )

    // not-a-cms.config.ts
    writeFileSync(
      join(projectDir, "not-a-cms.config.ts"),
      `import { defineConfig } from "@not-a-cms/core"
import { blogPost } from "./collections/blog-post"
import { page } from "./collections/page"
import { exampleExtension } from "./extensions/example"
import { starterTheme } from "./theme"

export default defineConfig({
  site: {
    name: "${projectName}",
    // Public site URL. In production set SITE_URL to your renderer origin.
    url: process.env.SITE_URL ?? "http://localhost:3000",
  },
  database: {
    provider: "sqlite",
    // Keep the database on persistent storage in production.
    url: process.env.DATABASE_URL ?? "data.db",
  },
  storage: {
    provider: "local",
    // Use MEDIA_STORAGE_PATH for a persistent upload volume in production.
    path: process.env.MEDIA_STORAGE_PATH ?? "./uploads",
  },
  // For S3/R2, replace the local storage block above with:
  // storage: {
  //   provider: "r2",
  //   path: process.env.MEDIA_INDEX_PATH ?? ".media-index",
  //   bucket: process.env.S3_BUCKET,
  //   endpoint: process.env.S3_ENDPOINT,
  //   region: process.env.S3_REGION ?? "auto",
  //   accessKeyId: process.env.S3_ACCESS_KEY_ID,
  //   secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  //   publicUrl: process.env.S3_PUBLIC_URL,
  //   prefix: process.env.S3_PREFIX ?? "uploads",
  // },
  auth: {
    methods: ["magic-link", "oauth"],
    magicLink: {
      from: process.env.MAGIC_LINK_FROM ?? "login@example.com",
    },
  },
  collections: [blogPost, page],
  extensions: [exampleExtension],
  theme: starterTheme,
  channels: {
    rss: {
      title: "${projectName}",
      description: "Latest posts from ${projectName}",
      collection: "blog_post",
      itemPath: "/blog/:slug",
    },
    email: {
      title: "${projectName}",
      footerText: "You are receiving updates from ${projectName}.",
    },
  },
  rendering: {
    blog_post: { mode: "isr", revalidate: 60 },
    page: { mode: "ssg" },
  },
})
`,
    )

    // Example extension
    writeFileSync(
      join(projectDir, "extensions/example.ts"),
      `import { defineExtension } from "@not-a-cms/core"

export const exampleExtension = defineExtension({
  name: "example-extension",
  version: "0.1.0",
  fields: [],
  blocks: [],
  admin: {
    panels: [
      {
        label: "Example Extension",
        href: "/extensions/example",
        section: "bottom",
        order: 50,
      },
    ],
  },
})
`,
    )

    // Starter theme
    writeFileSync(
      join(projectDir, "theme/index.ts"),
      `import { defineTheme } from "@not-a-cms/renderer"

export const starterTheme = defineTheme({
  name: "starter",
  version: "0.1.0",
  description: "Starter theme for ${projectName}",
  settings: {
    colors: {
      primary: { type: "color", default: "#2563eb", label: "Primary" },
      background: { type: "color", default: "#ffffff", label: "Background" },
    },
  },
  components: {
    hero: (props) =>
      \`<section class="theme-hero"><h1>\${escapeHtml(String(props.headline ?? ""))}</h1><p>\${escapeHtml(String(props.subheadline ?? ""))}</p></section>\`,
  },
})

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
`,
    )

    // Blog post collection
    writeFileSync(
      join(projectDir, "collections/blog-post.ts"),
      `import { defineCollection, field } from "@not-a-cms/core"

export const blogPost = defineCollection({
  name: "blog_post",
  labels: { singular: "Blog Post", plural: "Blog Posts" },
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    slug: field.slug({ from: "title" }),
    excerpt: field.text({ multiline: true, maxLength: 500 }),
    body: field.richText(),
    coverImage: field.media({ accept: ["image/*"] }),
    status: field.select(["draft", "in_review", "published", "archived", "scheduled"], { default: "draft" }),
    publishedAt: field.datetime(),
    tags: field.array(field.text()),
    seo: field.group({
      metaTitle: field.text(),
      metaDescription: field.text({ maxLength: 160 }),
    }),
  },
})
`,
    )

    // Page collection
    writeFileSync(
      join(projectDir, "collections/page.ts"),
      `import { defineCollection, field } from "@not-a-cms/core"

export const page = defineCollection({
  name: "page",
  labels: { singular: "Page", plural: "Pages" },
  fields: {
    title: field.text({ required: true }),
    slug: field.slug({ from: "title" }),
    body: field.richText(),
    status: field.select(["draft", "in_review", "published", "archived", "scheduled"], { default: "draft" }),
    publishedAt: field.datetime(),
  },
})
`,
    )

    // .env
    writeFileSync(
      join(projectDir, ".env"),
      `# Runtime
PORT=4321
BASE_URL=http://localhost:4321
SITE_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:4322,http://localhost:3000

# Data
DATABASE_URL=data.db
MEDIA_STORAGE_PATH=./uploads

# Auth
BETTER_AUTH_SECRET=${crypto.randomUUID()}${crypto.randomUUID()}

# Magic links are logged in development. Configure email delivery before production invites.
MAGIC_LINK_FROM=login@example.com

# Optional OAuth providers
# GITHUB_CLIENT_ID=
# GITHUB_CLIENT_SECRET=
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=

# Optional S3/R2 media storage
# STORAGE_PROVIDER=r2
# MEDIA_INDEX_PATH=.media-index
# S3_BUCKET=
# S3_ENDPOINT=
# S3_REGION=auto
# S3_ACCESS_KEY_ID=
# S3_SECRET_ACCESS_KEY=
# S3_PUBLIC_URL=
# S3_PREFIX=uploads
`,
    )

    // .gitignore
    writeFileSync(
      join(projectDir, ".gitignore"),
      `node_modules/
dist/
.turbo/
*.db
*.db-wal
*.db-shm
.env
.env.local
uploads/
`,
    )

    // tsconfig.json
    writeFileSync(
      join(projectDir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "ESNext",
            module: "ESNext",
            moduleResolution: "bundler",
            esModuleInterop: true,
            strict: true,
            skipLibCheck: true,
            types: ["bun"],
          },
        },
        null,
        2,
      ) + "\n",
    )

    console.log(`
  Project created! Next steps:

    cd ${projectName}
    bun install
    bun run dev

  Admin:    http://localhost:4322
  Site:     http://localhost:3000
  API:      http://localhost:4321/api
`)
  },
})
