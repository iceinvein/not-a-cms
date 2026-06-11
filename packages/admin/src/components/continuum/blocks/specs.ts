import type { BlockSchema } from "@not-a-cms/editor"

export type BlockSpec = {
  name: string
  label: string
  group?: string
  schema: BlockSchema
  /**
   * Top-level text attributes that the Visual-mode living view edits as inline canvas
   * holes. These are excluded from the inspector (you type them on the page, not in a
   * form). Text that lives inside an array field (e.g. feature card titles) is not
   * listed here; that text is edited inline within the array item by the living view.
   */
  inlineText?: string[]
  /** URL-backed text fields edited via the Vault media picker in the inspector. */
  mediaFields?: string[]
  /** Name of the select field surfaced as the on-canvas variant control, if any. */
  variantField?: string
  /** Name of the number field surfaced as the on-canvas column stepper, if any. */
  columnField?: string
}

export const blockSpecs: BlockSpec[] = [
  {
    name: "hero",
    label: "Hero",
    group: "sections",
    variantField: "align",
    inlineText: ["eyebrow", "headline", "subheadline"],
    mediaFields: ["backgroundImage"],
    schema: {
      eyebrow: { type: "text", default: "" },
      headline: { type: "text", default: "" },
      subheadline: { type: "text", default: "" },
      align: { type: "select", default: "center", options: ["center", "left"] },
      backgroundImage: { type: "text", default: "" },
      overlay: { type: "boolean", default: true },
      spacing: {
        type: "select",
        default: "normal",
        options: ["none", "compact", "normal", "spacious"],
      },
    },
  },
  {
    name: "cta",
    label: "Call to action",
    group: "sections",
    variantField: "variant",
    inlineText: ["label"],
    schema: {
      label: { type: "text", default: "" },
      url: { type: "text", default: "" },
      variant: { type: "select", default: "primary", options: ["primary", "secondary", "outline"] },
      spacing: {
        type: "select",
        default: "normal",
        options: ["none", "compact", "normal", "spacious"],
      },
    },
  },
  {
    name: "featureGrid",
    label: "Feature grid",
    group: "sections",
    columnField: "columns",
    inlineText: [],
    schema: {
      items: { type: "array", default: [] },
      columns: { type: "number", default: 3 },
      spacing: {
        type: "select",
        default: "normal",
        options: ["none", "compact", "normal", "spacious"],
      },
    },
  },
  {
    name: "image",
    label: "Image",
    group: "fields",
    inlineText: [],
    mediaFields: ["url"],
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
    inlineText: ["name", "role"],
    schema: {
      name: { type: "text", default: "" },
      role: { type: "text", default: "" },
    },
  },
  {
    name: "gallery",
    label: "Gallery",
    group: "fields",
    inlineText: [],
    schema: {
      images: { type: "array", default: [] },
    },
  },
  {
    name: "seo",
    label: "SEO & meta",
    group: "fields",
    inlineText: [],
    schema: {
      metaTitle: { type: "text", default: "" },
      metaDescription: { type: "text", default: "" },
    },
  },
  {
    name: "stats",
    label: "Stats",
    group: "sections",
    columnField: "columns",
    inlineText: [],
    schema: {
      items: { type: "array", default: [] },
      columns: { type: "number", default: 3 },
      spacing: {
        type: "select",
        default: "normal",
        options: ["none", "compact", "normal", "spacious"],
      },
    },
  },
  {
    name: "logoCloud",
    label: "Logo cloud",
    group: "sections",
    inlineText: ["eyebrow"],
    schema: {
      eyebrow: { type: "text", default: "" },
      logos: { type: "array", default: [] },
      spacing: {
        type: "select",
        default: "normal",
        options: ["none", "compact", "normal", "spacious"],
      },
    },
  },
  {
    name: "splitMedia",
    label: "Split media",
    group: "sections",
    variantField: "side",
    inlineText: ["heading", "body", "ctaLabel"],
    mediaFields: ["media"],
    schema: {
      media: { type: "text", default: "" },
      side: { type: "select", default: "left", options: ["left", "right"] },
      heading: { type: "text", default: "" },
      body: { type: "text", default: "" },
      ctaLabel: { type: "text", default: "" },
      ctaUrl: { type: "text", default: "" },
      spacing: {
        type: "select",
        default: "normal",
        options: ["none", "compact", "normal", "spacious"],
      },
    },
  },
  {
    name: "testimonial",
    label: "Testimonial",
    group: "sections",
    inlineText: ["quote", "name", "role"],
    mediaFields: ["avatar"],
    schema: {
      quote: { type: "text", default: "" },
      name: { type: "text", default: "" },
      role: { type: "text", default: "" },
      avatar: { type: "text", default: "" },
      spacing: {
        type: "select",
        default: "normal",
        options: ["none", "compact", "normal", "spacious"],
      },
    },
  },
  {
    name: "faq",
    label: "FAQ",
    group: "sections",
    inlineText: ["heading"],
    schema: {
      heading: { type: "text", default: "" },
      items: { type: "array", default: [] },
      spacing: {
        type: "select",
        default: "normal",
        options: ["none", "compact", "normal", "spacious"],
      },
    },
  },
  {
    name: "pricingCards",
    label: "Pricing cards",
    group: "sections",
    inlineText: ["heading"],
    schema: {
      heading: { type: "text", default: "" },
      tiers: { type: "array", default: [] },
      spacing: {
        type: "select",
        default: "normal",
        options: ["none", "compact", "normal", "spacious"],
      },
    },
  },
  {
    name: "collectionList",
    label: "Collection list",
    group: "sections",
    variantField: "layout",
    inlineText: ["heading"],
    schema: {
      collection: { type: "text", default: "blog_post" },
      limit: { type: "number", default: 3 },
      filterTag: { type: "text", default: "" },
      layout: { type: "select", default: "grid", options: ["grid", "list", "cards"] },
      showCover: { type: "boolean", default: true },
      showExcerpt: { type: "boolean", default: true },
      showDate: { type: "boolean", default: true },
      heading: { type: "text", default: "" },
      spacing: {
        type: "select",
        default: "normal",
        options: ["none", "compact", "normal", "spacious"],
      },
    },
  },
]
