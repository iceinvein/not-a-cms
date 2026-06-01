/**
 * Dev server entry point.
 * Run with: bun --hot packages/server/src/dev.ts
 *
 * This boots a working not-a-cms server with sample collections
 * for local development and testing.
 */
import { createServer } from "./index"
import { ConfigLoadError, defineCollection, field, loadConfig } from "@not-a-cms/core"
import { createServerConfigFromCMSConfig } from "./config"
import type { StorageConfig } from "./media/storage"

// --- Sample collections for development ---

const blogPost = defineCollection({
  name: "blog_post",
  labels: { singular: "Blog Post", plural: "Blog Posts" },
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    slug: field.slug({ from: "title" }),
    excerpt: field.text({ multiline: true, maxLength: 500 }),
    body: field.richText(),
    author: field.relation("author"),
    coverImage: field.media({ accept: ["image/*"] }),
    status: field.select(["draft", "in_review", "published", "archived", "scheduled"], { default: "draft" }),
    publishedAt: field.datetime(),
    tags: field.array(field.text()),
  },
})

const author = defineCollection({
  name: "author",
  labels: { singular: "Author", plural: "Authors" },
  fields: {
    name: field.text({ required: true }),
    bio: field.text({ multiline: true }),
  },
})

const page = defineCollection({
  name: "page",
  fields: {
    title: field.text({ required: true }),
    slug: field.slug({ from: "title" }),
    author: field.relation("author"),
    layout: field.pageLayout(),
    status: field.select(["draft", "in_review", "published", "archived", "scheduled"], { default: "draft" }),
    publishedAt: field.datetime(),
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

const e2eMagicLinks = new Map<string, string>()
const { server } = createServer(await resolveDevServerConfig())

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

function resolveDevStorage(): StorageConfig {
  const provider = process.env.STORAGE_PROVIDER
  if (provider === "s3" || provider === "r2") {
    return {
      provider,
      path: process.env.MEDIA_INDEX_PATH ?? process.env.STORAGE_INDEX_PATH ?? "./uploads",
      bucket: process.env.S3_BUCKET,
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? process.env.AWS_REGION,
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY,
      publicUrl: process.env.S3_PUBLIC_URL,
      prefix: process.env.S3_PREFIX,
    }
  }

  return {
    provider: "local",
    path: process.env.MEDIA_STORAGE_PATH ?? process.env.UPLOADS_DIR ?? "./uploads",
  }
}

async function resolveDevServerConfig() {
  try {
    const projectConfig = await loadConfig({ cwd: process.cwd() })
    return createServerConfigFromCMSConfig(projectConfig, process.env)
  } catch (error) {
    if (error instanceof ConfigLoadError && error.code === "CONFIG_NOT_FOUND") {
      return createSampleDevServerConfig()
    }
    throw error
  }
}

function createSampleDevServerConfig() {
  const port = parseInt(process.env.PORT ?? "4321")
  const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:4322,http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
  const oauth = {
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? { github: { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET } }
      : {}),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
      : {}),
  }

  return {
    port,
    database: { url: process.env.DATABASE_URL ?? "dev.db" },
    auth: {
      secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-do-not-use-in-production-" + "x".repeat(12),
      baseURL: process.env.BASE_URL ?? `http://localhost:${port}`,
      trustedOrigins: corsOrigins,
      magicLink: {
        sendMagicLink: async ({ email, url }: { email: string; url: string }) => {
          if (process.env.E2E_TEST_AUTH === "1") {
            e2eMagicLinks.set(email, url)
          }
          console.log(`\n  Magic link for ${email}:`)
          console.log(`    ${url}\n`)
        },
      },
      ...(Object.keys(oauth).length > 0 ? { oauth } : {}),
    },
    email: {
      send: async ({ to, subject, html, text }: { to: string; subject: string; html?: string; text?: string }) => {
        console.log(`\n  Email to ${to}:`)
        console.log(`    Subject: ${subject}`)
        if (text) console.log(`    Text: ${text}`)
        if (html) console.log(`    HTML: ${html}`)
        console.log("")
      },
    },
    storage: resolveDevStorage(),
    collections: [author, blogPost, page],
    components: sampleComponents,
    cors: { origins: corsOrigins },
    ...(process.env.E2E_TEST_AUTH === "1"
      ? {
          testAuth: {
            enabled: true,
            getMagicLink: (email: string) => e2eMagicLinks.get(email) ?? null,
          },
        }
      : {}),
  }
}
