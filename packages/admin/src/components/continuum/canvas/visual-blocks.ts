import { type DefinedBlock, defineBlock } from "@not-a-cms/editor"
import { blockSpecs } from "../blocks/specs"
import { SectionPreview } from "./SectionPreview"

/**
 * The same section blocks as Document mode (identical names + schemas, so the same
 * Portable Text parses identically), but each rendered by the read-only SectionPreview
 * for the Visual canvas.
 */
export const visualBlocks: DefinedBlock[] = blockSpecs.map((spec) =>
  defineBlock({
    name: spec.name,
    label: spec.label,
    group: spec.group,
    schema: spec.schema,
    editor: SectionPreview,
  }),
)
