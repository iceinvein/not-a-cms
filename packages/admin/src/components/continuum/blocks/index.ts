import { type DefinedBlock, defineBlock, type SlashCommandItem } from "@not-a-cms/editor"
import type { ComponentType } from "react"
import { AuthorBlockView } from "./author-block"
import { CollectionListBlockView } from "./collection-list-block"
import { CtaBlockView } from "./cta-block"
import { FaqBlockView } from "./faq-block"
import { FeatureGridBlockView } from "./feature-grid-block"
import { GalleryBlockView } from "./gallery-block"
import { HeroBlockView } from "./hero-block"
import { ImageBlockView } from "./image-block"
import { LogoCloudBlockView } from "./logo-cloud-block"
import { PricingCardsBlockView } from "./pricing-cards-block"
import { SeoBlockView } from "./seo-block"
import { blockSpecs } from "./specs"
import { SplitMediaBlockView } from "./split-media-block"
import { StatsBlockView } from "./stats-block"
import { TestimonialBlockView } from "./testimonial-block"

const FORM_VIEWS: Record<string, ComponentType<any>> = {
  hero: HeroBlockView,
  cta: CtaBlockView,
  featureGrid: FeatureGridBlockView,
  image: ImageBlockView,
  author: AuthorBlockView,
  gallery: GalleryBlockView,
  seo: SeoBlockView,
  stats: StatsBlockView,
  logoCloud: LogoCloudBlockView,
  splitMedia: SplitMediaBlockView,
  testimonial: TestimonialBlockView,
  faq: FaqBlockView,
  pricingCards: PricingCardsBlockView,
  collectionList: CollectionListBlockView,
}

export const continuumBlocks: DefinedBlock[] = blockSpecs.map((spec) =>
  defineBlock({
    name: spec.name,
    label: spec.label,
    group: spec.group,
    schema: spec.schema,
    editor: FORM_VIEWS[spec.name],
  }),
)

const insert = (name: string) => (editor: any, range: any) =>
  editor.chain().focus().deleteRange(range).insertContent({ type: name }).run()

export const continuumSlashCommands: SlashCommandItem[] = [
  {
    title: "Hero",
    description: "Headline, subheadline, eyebrow",
    group: "sections",
    command: insert("hero"),
  },
  {
    title: "Call to action",
    description: "A button linking somewhere",
    group: "sections",
    command: insert("cta"),
  },
  {
    title: "Feature grid",
    description: "Columns of title/text cards",
    group: "sections",
    command: insert("featureGrid"),
  },
  {
    title: "Image",
    description: "Insert an image from the library",
    group: "fields",
    command: insert("image"),
  },
  { title: "Author", description: "Structured byline", group: "fields", command: insert("author") },
  {
    title: "Gallery",
    description: "Images from the library",
    group: "fields",
    command: insert("gallery"),
  },
  {
    title: "SEO & meta",
    description: "Title, description",
    group: "fields",
    command: insert("seo"),
  },
  {
    title: "Stats",
    description: "Grid of key metrics or social proof numbers",
    group: "sections",
    command: insert("stats"),
  },
  {
    title: "Logo cloud",
    description: "Row of partner or customer logos",
    group: "sections",
    command: insert("logoCloud"),
  },
  {
    title: "Split media",
    description: "Two-column image and text layout",
    group: "sections",
    command: insert("splitMedia"),
  },
  {
    title: "Testimonial",
    description: "Pull-quote with name, role, and avatar",
    group: "sections",
    command: insert("testimonial"),
  },
  {
    title: "FAQ",
    description: "Collapsible question and answer list",
    group: "sections",
    command: insert("faq"),
  },
  {
    title: "Pricing cards",
    description: "Tier cards with features and CTA buttons",
    group: "sections",
    command: insert("pricingCards"),
  },
  {
    title: "Collection list",
    description: "Live list of published documents from a collection",
    group: "sections",
    command: insert("collectionList"),
  },
]
