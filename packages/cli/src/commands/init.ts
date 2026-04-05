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
            preview: "not-a-cms preview",
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

export default defineConfig({
  site: {
    name: "${projectName}",
    url: "http://localhost:4321",
  },
  database: {
    provider: "sqlite",
    url: "data.db",
  },
  storage: {
    provider: "local",
    path: "./uploads",
  },
  auth: {
    methods: ["passkey", "magic-link"],
    magicLink: {
      from: "login@example.com",
    },
  },
  collections: [blogPost, page],
  extensions: [],
  rendering: {
    blog_post: { mode: "isr", revalidate: 60 },
    page: { mode: "ssg" },
  },
})
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
    status: field.select(["draft", "published", "archived"], { default: "draft" }),
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
    status: field.select(["draft", "published"], { default: "draft" }),
  },
})
`,
    )

    // .env
    writeFileSync(
      join(projectDir, ".env"),
      `DATABASE_URL=data.db
BETTER_AUTH_SECRET=${crypto.randomUUID()}${crypto.randomUUID()}
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
            types: ["bun-types"],
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

  Admin:    http://localhost:4321/admin
  Site:     http://localhost:4321
  API:      http://localhost:4321/api
`)
  },
})
