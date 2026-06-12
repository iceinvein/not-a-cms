// packages/admin/src/components/continuum/canvas/frame-scale.ts
import type { FrameWidth } from "./WidthSelector"

/** Tablet and mobile preview at fixed device widths. */
export const FRAME_PRESET_WIDTHS = { tablet: 834, mobile: 390 } as const

/**
 * Minimum width the Desktop preset is laid out at. Above the section breakpoints (900px), so the
 * desktop preview always shows a true desktop layout even when the editor stage is narrow.
 */
export const DESKTOP_BASE_WIDTH = 1280

/**
 * Resolve how the responsive preview frame should render for a given preset inside an editor stage
 * of `stageWidth` pixels.
 *
 * The frame is laid out at its true device width (`layoutWidth`) so the `@container` queries fire
 * at the real device width, then visually scaled by `scale` to fit the stage. Desktop stays fluid
 * when the stage is at least `DESKTOP_BASE_WIDTH` (no downscale) and falls back to the base width
 * (scaled) on narrower stages, so it never collapses into a tablet/mobile layout. Tablet and mobile
 * use their fixed widths and only ever scale down (never up). Pure, so it is unit-tested.
 */
export function frameLayout(
  stageWidth: number,
  preset: FrameWidth,
): { layoutWidth: number; scale: number } {
  const layoutWidth =
    preset === "tablet"
      ? FRAME_PRESET_WIDTHS.tablet
      : preset === "mobile"
        ? FRAME_PRESET_WIDTHS.mobile
        : Math.max(stageWidth, DESKTOP_BASE_WIDTH)
  const scale = stageWidth > 0 ? Math.min(1, stageWidth / layoutWidth) : 1
  return { layoutWidth, scale }
}
