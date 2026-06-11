// packages/admin/src/components/continuum/canvas/block-controls.ts
import type { BlockSpec } from "../blocks/specs"
import { SPACING_STEPS, type SpacingStep } from "./spacing"

export const COLUMN_MIN = 2
export const COLUMN_MAX = 4

export type VariantControl = { field: string; options: string[]; value: string }
export type ColumnControl = { field: string; value: number; min: number; max: number }
export type SpacingControl = { value: SpacingStep }
export type BlockControlSet = {
  variant?: VariantControl
  columns?: ColumnControl
  spacing?: SpacingControl
}

/** Minimal view of a schema field def (the admin can't import the editor's BlockSchema type cheaply). */
type FieldDef = { type?: string; default?: unknown; options?: unknown[] }

/**
 * Resolve, from a block spec and a node's attrs, which on-canvas gutter controls apply and their
 * current values: a variant select (if `variantField` is set), a column stepper (if `columnField`
 * is set), and a spacing step for any section-group block. Pure: the single source of truth for
 * what the gutter shows, so BlockControls has no branching logic to test through SSR.
 */
export function resolveBlockControls(
  spec: BlockSpec,
  attrs: Record<string, unknown>,
): BlockControlSet {
  const set: BlockControlSet = {}

  if (spec.variantField) {
    const def = spec.schema[spec.variantField] as FieldDef | undefined
    const options = Array.isArray(def?.options) ? def.options.map(String) : []
    if (options.length > 0) {
      const value = String(attrs[spec.variantField] ?? def?.default ?? options[0])
      set.variant = { field: spec.variantField, options, value }
    }
  }

  if (spec.columnField) {
    const def = spec.schema[spec.columnField] as FieldDef | undefined
    const value = Number(attrs[spec.columnField] ?? def?.default ?? COLUMN_MIN)
    set.columns = { field: spec.columnField, value, min: COLUMN_MIN, max: COLUMN_MAX }
  }

  if (spec.group === "sections") {
    const raw = String(attrs.spacing ?? "normal")
    const value = (SPACING_STEPS as readonly string[]).includes(raw)
      ? (raw as SpacingStep)
      : "normal"
    set.spacing = { value }
  }

  return set
}
