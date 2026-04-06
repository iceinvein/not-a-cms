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
    layout: field.pageLayout(),
    status: field.select(["draft", "published"], { default: "draft" }),
  },
})

// --- Sample components for the visual builder ---

const sampleComponents = [
  {
    name: "hero",
    label: "Hero Section",
    category: "sections",
    icon: "layout",
    props: {
      headline: { type: "text" as const, default: "Welcome", label: "Headline" },
      subheadline: { type: "text" as const, label: "Subheadline" },
      backgroundImage: { type: "media" as const, label: "Background Image" },
    },
  },
  {
    name: "text_block",
    label: "Text Block",
    category: "content",
    icon: "type",
    props: {
      content: { type: "text" as const, label: "Content" },
      alignment: { type: "select" as const, options: ["left", "center", "right"], default: "left", label: "Alignment" },
    },
  },
  {
    name: "image_block",
    label: "Image",
    category: "content",
    icon: "image",
    props: {
      src: { type: "media" as const, label: "Image" },
      alt: { type: "text" as const, label: "Alt Text" },
      caption: { type: "text" as const, label: "Caption" },
    },
  },
  {
    name: "cta",
    label: "Call to Action",
    category: "actions",
    icon: "mouse-pointer",
    props: {
      label: { type: "text" as const, default: "Get Started", label: "Button Label" },
      url: { type: "text" as const, label: "URL" },
      variant: { type: "select" as const, options: ["primary", "secondary", "outline"], default: "primary", label: "Style" },
    },
  },
]

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
  components: sampleComponents,
})

if (!process.env.QUIET) {
  console.log(`
  API running on http://localhost:${server.port}

    REST:     http://localhost:${server.port}/api/{collection}
    Schema:   http://localhost:${server.port}/api/_schema
    Health:   http://localhost:${server.port}/health
    Auth:     http://localhost:${server.port}/api/auth
    Collab:   ws://localhost:${server.port}/collab
  `)
}
