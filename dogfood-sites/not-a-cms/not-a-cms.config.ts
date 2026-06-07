import { defineConfig, defineCollection, field } from "@not-a-cms/core"

const author = defineCollection({
  name: "author",
  labels: { singular: "Author", plural: "Authors" },
  fields: {
    name: field.text({ required: true }),
    bio: field.text({ multiline: true }),
  },
})

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

const page = defineCollection({
  name: "page",
  fields: {
    title: field.text({ required: true }),
    slug: field.slug({ from: "title" }),
    author: field.relation("author"),
    body: field.richText(),
    status: field.select(["draft", "in_review", "published", "archived", "scheduled"], { default: "draft" }),
    publishedAt: field.datetime(),
  },
})

export default defineConfig({
  site: {
    name: "not-a-cms",
    nav: {
      links: [
        { label: "Product", href: "/" },
        { label: "Pricing", href: "/pricing" },
        { label: "Blog", href: "/blog" },
      ],
      cta: { label: "Get started", href: "/pricing" },
    },
    footer: {
      tagline: "The CMS that finally replaced WordPress.",
      columns: [
        {
          heading: "Product",
          links: [
            { label: "Pricing", href: "/pricing" },
            { label: "Blog", href: "/blog" },
          ],
        },
        {
          heading: "Company",
          links: [{ label: "About", href: "/about" }],
        },
      ],
      legal: "© 2026 not-a-cms",
    },
  },
  database: { url: "dogfood.db" },
  storage: { provider: "local", path: "./uploads" },
  collections: [author, blogPost, page],
  theme: {
    name: "not-a-cms",
    version: "1.0.0",
    settings: { colors: { accent: { default: "#c2410c" } } },
  },
})
