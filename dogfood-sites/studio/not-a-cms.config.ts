import { defineConfig, defineCollection, field } from "@not-a-cms/core"

const project = defineCollection({
  name: "project",
  labels: { singular: "Project", plural: "Projects" },
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    slug: field.slug({ from: "title" }),
    summary: field.text({ multiline: true, maxLength: 500 }),
    coverImage: field.media({ accept: ["image/*"] }),
    year: field.text(),
    role: field.text(),
    liveUrl: field.text(),
    body: field.richText(),
    gallery: field.array(field.media({ accept: ["image/*"] })),
    status: field.select(["draft", "in_review", "published", "archived", "scheduled"], { default: "draft" }),
    publishedAt: field.datetime(),
  },
})

const blogPost = defineCollection({
  name: "blog_post",
  labels: { singular: "Journal Entry", plural: "Journal" },
  fields: {
    title: field.text({ required: true, maxLength: 200 }),
    slug: field.slug({ from: "title" }),
    excerpt: field.text({ multiline: true, maxLength: 500 }),
    body: field.richText(),
    coverImage: field.media({ accept: ["image/*"] }),
    status: field.select(["draft", "in_review", "published", "archived", "scheduled"], { default: "draft" }),
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
    status: field.select(["draft", "in_review", "published", "archived", "scheduled"], { default: "draft" }),
    publishedAt: field.datetime(),
  },
})

export default defineConfig({
  routes: [{ collection: "project", path: "/work/:slug" }],
  site: {
    name: "Atelier",
    nav: {
      links: [
        { label: "Work", href: "/work" },
        { label: "Studio", href: "/about" },
        { label: "Journal", href: "/blog" },
      ],
      cta: { label: "Start a project", href: "/contact" },
    },
    footer: {
      tagline: "An independent design studio.",
      social: [
        { label: "Instagram", href: "https://instagram.com", external: true },
        { label: "Are.na", href: "https://are.na", external: true },
      ],
      legal: "© 2026 Atelier",
    },
  },
  database: { url: "studio.db" },
  storage: { provider: "local", path: "./uploads" },
  collections: [project, blogPost, page],
  theme: {
    name: "atelier-studio",
    version: "1.0.0",
    // A dark, bold, grotesk identity: the inverse of not-a-cms's warm paper + serif,
    // proving the theme tokens span light to dark with only config changes.
    settings: {
      colors: {
        paper: { default: "#0d0d0f" },
        surface: { default: "#16161a" },
        ink: { default: "#f5f5f4" },
        body: { default: "#c4c4c8" },
        muted: { default: "#8a8a92" },
        border: { default: "#2a2a30" },
        accent: { default: "#d8fe5c" },
        accentInk: { default: "#0d0d0f" },
      },
      fonts: {
        display: { default: '"Space Grotesk", "Helvetica Neue", Arial, sans-serif' },
        body: { default: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
        import: {
          default:
            "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap",
        },
      },
    },
  },
})
