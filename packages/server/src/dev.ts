/**
 * Dev server entry point.
 * Run with: bun --hot packages/server/src/dev.ts
 *
 * This boots a working not-a-cms server with sample collections
 * for local development and testing.
 */
import { createServer } from "./index"
import { defineCollection, field } from "@not-a-cms/core"

// --- Sample collections for development ---

const blogPost = defineCollection({
  name: "blog_post",
  labels: { singular: "Blog Post", plural: "Blog Posts" },
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    slug: field.slug({ from: "title" }),
    excerpt: field.text({ multiline: true, maxLength: 500 }),
    body: field.richText(),
    status: field.select(["draft", "published", "archived"], { default: "draft" }),
    publishedAt: field.datetime(),
    tags: field.array(field.text()),
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

// --- Boot the server ---

const port = parseInt(process.env.PORT ?? "4321")

const { server } = createServer({
  port,
  database: { url: process.env.DATABASE_URL ?? "dev.db" },
  auth: {
    secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-do-not-use-in-production-" + "x".repeat(12),
    baseURL: process.env.BASE_URL ?? `http://localhost:${port}`,
    magicLink: {
      sendMagicLink: async ({ email, url }) => {
        console.log(`\n  ✉ Magic link for ${email}:`)
        console.log(`    ${url}\n`)
      },
    },
  },
  collections: [blogPost, page],
})

console.log(`
  Admin:    http://localhost:${server.port}/admin    (coming soon)
  API:      http://localhost:${server.port}/api
  Health:   http://localhost:${server.port}/health
  Auth:     http://localhost:${server.port}/api/auth

  Collections:
    - blog_post  →  /api/blog_post
    - page       →  /api/page

  Try it:
    curl http://localhost:${server.port}/api/blog_post
    curl -X POST http://localhost:${server.port}/api/blog_post \\
      -H "Content-Type: application/json" \\
      -d '{"title":"Hello World","slug":"hello-world","status":"draft"}'
`)
