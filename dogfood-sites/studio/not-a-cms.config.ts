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
  site: { name: "Atelier" },
  database: { url: "studio.db" },
  storage: { provider: "local", path: "./uploads" },
  collections: [project, blogPost, page],
  theme: {
    name: "atelier-studio",
    version: "1.0.0",
    settings: { colors: { accent: { default: "#e2e8f0" } } },
  },
})
