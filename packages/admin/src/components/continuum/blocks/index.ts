import { defineBlock, type DefinedBlock, type SlashCommandItem } from "@not-a-cms/editor"
import { AuthorBlockView } from "./author-block"
import { CtaBlockView } from "./cta-block"
import { FaqBlockView } from "./faq-block"
import { FeatureGridBlockView } from "./feature-grid-block"
import { PricingCardsBlockView } from "./pricing-cards-block"
import { GalleryBlockView } from "./gallery-block"
import { HeroBlockView } from "./hero-block"
import { ImageBlockView } from "./image-block"
import { SeoBlockView } from "./seo-block"
import { StatsBlockView } from "./stats-block"
import { LogoCloudBlockView } from "./logo-cloud-block"
import { SplitMediaBlockView } from "./split-media-block"
import { TestimonialBlockView } from "./testimonial-block"

export const continuumBlocks: DefinedBlock[] = [
  defineBlock({
    name: "hero",
    label: "Hero",
    schema: {
      eyebrow: { type: "text", default: "" },
      headline: { type: "text", default: "" },
      subheadline: { type: "text", default: "" },
      align: { type: "select", default: "center", options: ["center", "left"] },
      backgroundImage: { type: "text", default: "" },
      overlay: { type: "boolean", default: true },
    },
    editor: HeroBlockView,
  }),
  defineBlock({
    name: "cta",
    label: "Call to action",
    schema: {
      label: { type: "text", default: "" },
      url: { type: "text", default: "" },
      variant: { type: "select", default: "primary", options: ["primary", "secondary", "outline"] },
    },
    editor: CtaBlockView,
  }),
  defineBlock({
    name: "featureGrid",
    label: "Feature grid",
    schema: {
      items: { type: "array", default: [] },
      columns: { type: "number", default: 3 },
    },
    editor: FeatureGridBlockView,
  }),
  defineBlock({
    name: "image",
    label: "Image",
    schema: {
      url: { type: "text", default: "" },
      mediaId: { type: "text", default: "" },
      alt: { type: "text", default: "" },
    },
    editor: ImageBlockView,
  }),
  defineBlock({
    name: "author",
    label: "Author",
    schema: {
      name: { type: "text", default: "" },
      role: { type: "text", default: "" },
    },
    editor: AuthorBlockView,
  }),
  defineBlock({
    name: "gallery",
    label: "Gallery",
    schema: {
      images: { type: "array", default: [] },
    },
    editor: GalleryBlockView,
  }),
  defineBlock({
    name: "seo",
    label: "SEO & meta",
    schema: {
      metaTitle: { type: "text", default: "" },
      metaDescription: { type: "text", default: "" },
    },
    editor: SeoBlockView,
  }),
  defineBlock({
    name: "stats",
    label: "Stats",
    schema: {
      items: { type: "array", default: [] },
      columns: { type: "number", default: 3 },
    },
    editor: StatsBlockView,
  }),
  defineBlock({
    name: "logoCloud",
    label: "Logo cloud",
    schema: {
      eyebrow: { type: "text", default: "" },
      logos: { type: "array", default: [] },
    },
    editor: LogoCloudBlockView,
  }),
  defineBlock({
    name: "splitMedia",
    label: "Split media",
    schema: {
      media: { type: "text", default: "" },
      side: { type: "select", default: "left", options: ["left", "right"] },
      heading: { type: "text", default: "" },
      body: { type: "text", default: "" },
      ctaLabel: { type: "text", default: "" },
      ctaUrl: { type: "text", default: "" },
    },
    editor: SplitMediaBlockView,
  }),
  defineBlock({
    name: "testimonial",
    label: "Testimonial",
    schema: {
      quote: { type: "text", default: "" },
      name: { type: "text", default: "" },
      role: { type: "text", default: "" },
      avatar: { type: "text", default: "" },
    },
    editor: TestimonialBlockView,
  }),
  defineBlock({
    name: "faq",
    label: "FAQ",
    schema: {
      heading: { type: "text", default: "" },
      items: { type: "array", default: [] },
    },
    editor: FaqBlockView,
  }),
  defineBlock({
    name: "pricingCards",
    label: "Pricing cards",
    schema: {
      heading: { type: "text", default: "" },
      tiers: { type: "array", default: [] },
    },
    editor: PricingCardsBlockView,
  }),
]

const insert = (name: string) => (editor: any, range: any) =>
  editor.chain().focus().deleteRange(range).insertContent({ type: name }).run()

export const continuumSlashCommands: SlashCommandItem[] = [
  { title: "Hero", description: "Headline, subheadline, eyebrow", group: "sections", command: insert("hero") },
  { title: "Call to action", description: "A button linking somewhere", group: "sections", command: insert("cta") },
  { title: "Feature grid", description: "Columns of title/text cards", group: "sections", command: insert("featureGrid") },
  { title: "Image", description: "Insert an image from the library", group: "fields", command: insert("image") },
  { title: "Author", description: "Structured byline", group: "fields", command: insert("author") },
  { title: "Gallery", description: "Images from the library", group: "fields", command: insert("gallery") },
  { title: "SEO & meta", description: "Title, description", group: "fields", command: insert("seo") },
  { title: "Stats", description: "Grid of key metrics or social proof numbers", group: "sections", command: insert("stats") },
  { title: "Logo cloud", description: "Row of partner or customer logos", group: "sections", command: insert("logoCloud") },
  { title: "Split media", description: "Two-column image and text layout", group: "sections", command: insert("splitMedia") },
  { title: "Testimonial", description: "Pull-quote with name, role, and avatar", group: "sections", command: insert("testimonial") },
  { title: "FAQ", description: "Collapsible question and answer list", group: "sections", command: insert("faq") },
  { title: "Pricing cards", description: "Tier cards with features and CTA buttons", group: "sections", command: insert("pricingCards") },
]
