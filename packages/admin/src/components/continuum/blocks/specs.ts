import type { BlockSchema } from "@not-a-cms/editor"

export type BlockSpec = {
  name: string
  label: string
  group?: string
  schema: BlockSchema
}

export const blockSpecs: BlockSpec[] = [
  {
    name: "hero",
    label: "Hero",
    group: "sections",
    schema: {
      eyebrow: { type: "text", default: "" },
      headline: { type: "text", default: "" },
      subheadline: { type: "text", default: "" },
      align: { type: "select", default: "center", options: ["center", "left"] },
      backgroundImage: { type: "text", default: "" },
      overlay: { type: "boolean", default: true },
    },
  },
  {
    name: "cta",
    label: "Call to action",
    group: "sections",
    schema: {
      label: { type: "text", default: "" },
      url: { type: "text", default: "" },
      variant: { type: "select", default: "primary", options: ["primary", "secondary", "outline"] },
    },
  },
  {
    name: "featureGrid",
    label: "Feature grid",
    group: "sections",
    schema: {
      items: { type: "array", default: [] },
      columns: { type: "number", default: 3 },
    },
  },
  {
    name: "image",
    label: "Image",
    group: "fields",
    schema: {
      url: { type: "text", default: "" },
      mediaId: { type: "text", default: "" },
      alt: { type: "text", default: "" },
    },
  },
  {
    name: "author",
    label: "Author",
    group: "fields",
    schema: {
      name: { type: "text", default: "" },
      role: { type: "text", default: "" },
    },
  },
  {
    name: "gallery",
    label: "Gallery",
    group: "fields",
    schema: {
      images: { type: "array", default: [] },
    },
  },
  {
    name: "seo",
    label: "SEO & meta",
    group: "fields",
    schema: {
      metaTitle: { type: "text", default: "" },
      metaDescription: { type: "text", default: "" },
    },
  },
  {
    name: "stats",
    label: "Stats",
    group: "sections",
    schema: {
      items: { type: "array", default: [] },
      columns: { type: "number", default: 3 },
    },
  },
  {
    name: "logoCloud",
    label: "Logo cloud",
    group: "sections",
    schema: {
      eyebrow: { type: "text", default: "" },
      logos: { type: "array", default: [] },
    },
  },
  {
    name: "splitMedia",
    label: "Split media",
    group: "sections",
    schema: {
      media: { type: "text", default: "" },
      side: { type: "select", default: "left", options: ["left", "right"] },
      heading: { type: "text", default: "" },
      body: { type: "text", default: "" },
      ctaLabel: { type: "text", default: "" },
      ctaUrl: { type: "text", default: "" },
    },
  },
  {
    name: "testimonial",
    label: "Testimonial",
    group: "sections",
    schema: {
      quote: { type: "text", default: "" },
      name: { type: "text", default: "" },
      role: { type: "text", default: "" },
      avatar: { type: "text", default: "" },
    },
  },
  {
    name: "faq",
    label: "FAQ",
    group: "sections",
    schema: {
      heading: { type: "text", default: "" },
      items: { type: "array", default: [] },
    },
  },
  {
    name: "pricingCards",
    label: "Pricing cards",
    group: "sections",
    schema: {
      heading: { type: "text", default: "" },
      tiers: { type: "array", default: [] },
    },
  },
  {
    name: "collectionList",
    label: "Collection list",
    group: "sections",
    schema: {
      collection: { type: "text", default: "blog_post" },
      limit: { type: "number", default: 3 },
      filterTag: { type: "text", default: "" },
      layout: { type: "select", default: "grid", options: ["grid", "list", "cards"] },
      showCover: { type: "boolean", default: true },
      showExcerpt: { type: "boolean", default: true },
      showDate: { type: "boolean", default: true },
      heading: { type: "text", default: "" },
    },
  },
]
