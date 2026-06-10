import { type DefinedBlock, defineBlock } from "@not-a-cms/editor"
import type { ComponentType } from "react"
import { blockSpecs } from "../blocks/specs"
import { CtaLivingView } from "./living/CtaLiving"
import { FaqLivingView } from "./living/FaqLiving"
import { FeatureGridLivingView } from "./living/FeatureGridLiving"
import { HeroLivingView } from "./living/HeroLiving"
import { LogoCloudLivingView } from "./living/LogoCloudLiving"
import { StatsLivingView } from "./living/StatsLiving"
import { SplitMediaLivingView } from "./living/SplitMediaLiving"
import { TestimonialLivingView } from "./living/TestimonialLiving"
import { PricingCardsLivingView } from "./living/PricingCardsLiving"
import { CollectionListLivingView } from "./living/CollectionListLiving"
import { SectionPreview } from "./SectionPreview"

/**
 * Inline-editable node-views, keyed by block name. Blocks not listed here fall back to the
 * Phase 1 read-only SectionPreview, so the canvas stays usable as living views are added
 * block-by-block across Phase 2A/2B/2C.
 */
export const LIVING_VIEWS: Record<string, ComponentType<any>> = {
  hero: HeroLivingView,
  cta: CtaLivingView,
  faq: FaqLivingView,
  featureGrid: FeatureGridLivingView,
  logoCloud: LogoCloudLivingView,
  stats: StatsLivingView,
  splitMedia: SplitMediaLivingView,
  testimonial: TestimonialLivingView,
  pricingCards: PricingCardsLivingView,
  collectionList: CollectionListLivingView,
}

export const livingBlocks: DefinedBlock[] = blockSpecs.map((spec) =>
  defineBlock({
    name: spec.name,
    label: spec.label,
    group: spec.group,
    schema: spec.schema,
    editor: LIVING_VIEWS[spec.name] ?? SectionPreview,
  }),
)
