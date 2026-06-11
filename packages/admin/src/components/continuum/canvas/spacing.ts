// packages/admin/src/components/continuum/canvas/spacing.ts

/** The discrete vertical-spacing scale for section blocks, ordered tightest to loosest. */
export const SPACING_STEPS = ["none", "compact", "normal", "spacious"] as const
export type SpacingStep = (typeof SPACING_STEPS)[number]

/** Human label for a spacing step, e.g. "spacious" -> "Spacious". */
export function spacingLabel(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : ""
}

/**
 * Map a vertical drag from `current` to a spacing step. Dragging down (positive `dragDeltaY`)
 * loosens toward "spacious"; dragging up tightens toward "none". `stepPx` is the pixels per step.
 * An unknown `current` is treated as "normal".
 */
export function snapSpacing(current: string, dragDeltaY: number, stepPx: number): SpacingStep {
  const start = (SPACING_STEPS as readonly string[]).indexOf(current)
  const base = start < 0 ? SPACING_STEPS.indexOf("normal") : start
  const delta = Math.round(dragDeltaY / stepPx)
  const next = Math.min(SPACING_STEPS.length - 1, Math.max(0, base + delta))
  return SPACING_STEPS[next]
}

/** The `data-spacing` attribute object for a value, empty unless it is a real non-default step. */
export function spacingDataAttr(value: unknown): Record<string, string> {
  return value && value !== "normal" ? { "data-spacing": String(value) } : {}
}
