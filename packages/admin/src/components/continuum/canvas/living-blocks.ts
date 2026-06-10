import { type DefinedBlock, defineBlock } from "@not-a-cms/editor"
import type { ComponentType } from "react"
import { blockSpecs } from "../blocks/specs"
import { CtaLivingView } from "./living/CtaLiving"
import { FeatureGridLivingView } from "./living/FeatureGridLiving"
import { HeroLivingView } from "./living/HeroLiving"
import { SectionPreview } from "./SectionPreview"

/**
 * Inline-editable node-views, keyed by block name. Blocks not listed here fall back to the
 * Phase 1 read-only SectionPreview, so the canvas stays usable as living views are added
 * block-by-block across Phase 2A/2B/2C.
 */
export const LIVING_VIEWS: Record<string, ComponentType<any>> = {
  hero: HeroLivingView,
  cta: CtaLivingView,
  featureGrid: FeatureGridLivingView,
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
