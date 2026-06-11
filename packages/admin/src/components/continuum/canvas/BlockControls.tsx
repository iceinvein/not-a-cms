// packages/admin/src/components/continuum/canvas/BlockControls.tsx
import type React from "react"
import { useState } from "react"
import type { BlockSpec } from "../blocks/specs"
import { resolveBlockControls } from "./block-controls"
import { snapSpacing, spacingLabel } from "./spacing"

type Props = {
  spec: BlockSpec
  attrs: Record<string, unknown>
  commit: (patch: Record<string, unknown>) => void
}

/** Pixels of vertical drag per spacing step. */
const SPACING_STEP_PX = 28

/** Popover listing a variant select's options; the active option is marked. */
export function VariantPopover({
  options,
  value,
  onPick,
}: {
  options: string[]
  value: string
  onPick: (option: string) => void
}) {
  return (
    <div className="cn-gutter-popover" role="menu" aria-label="Variant">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="menuitem"
          className="cn-gutter-option"
          data-value={option}
          data-active={option === value ? "true" : undefined}
          onClick={() => onPick(option)}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

/** Compact -/+ stepper for a clamped column count. */
export function ColumnStepper({
  value,
  min,
  max,
  onStep,
}: {
  value: number
  min: number
  max: number
  onStep: (next: number) => void
}) {
  return (
    <div className="cn-gutter-popover cn-gutter-stepper" role="group" aria-label="Columns">
      <button
        type="button"
        className="cn-gutter-step"
        aria-label="Fewer columns"
        disabled={value <= min}
        onClick={() => onStep(Math.max(min, value - 1))}
      >
        &minus;
      </button>
      <span className="cn-gutter-count" data-count={value}>
        {value}
      </span>
      <button
        type="button"
        className="cn-gutter-step"
        aria-label="More columns"
        disabled={value >= max}
        onClick={() => onStep(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  )
}

/**
 * Left-gutter stack of direct-manipulation controls for the selected block: a variant button that
 * opens VariantPopover, a column button that opens ColumnStepper, and a spacing drag handle that
 * snaps through the spacing scale. Which affordances appear is decided by resolveBlockControls.
 * All writes go through `commit` (the shared setBlockAttrs). Pointer-only HUD: aria-hidden with
 * tabIndex={-1} controls (keyboard editing is the inspector); positioning is owned by CanvasOverlay.
 */
export function BlockControls({ spec, attrs, commit }: Props) {
  const controls = resolveBlockControls(spec, attrs)
  const [open, setOpen] = useState<"variant" | "columns" | null>(null)
  const [dragStep, setDragStep] = useState<string | null>(null)

  const startSpacingDrag = (e: React.PointerEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startStep = controls.spacing?.value ?? "normal"
    setDragStep(startStep)
    const onMove = (ev: PointerEvent) =>
      setDragStep(snapSpacing(startStep, ev.clientY - startY, SPACING_STEP_PX))
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      const next = snapSpacing(startStep, ev.clientY - startY, SPACING_STEP_PX)
      setDragStep(null)
      if (next !== startStep) commit({ spacing: next })
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  return (
    <div className="cn-gutter" aria-hidden="true">
      {controls.variant ? (
        <div className="cn-gutter-control">
          <button
            type="button"
            tabIndex={-1}
            className="cn-gutter-btn cn-gutter-variant"
            aria-label="Variant"
            onClick={() => setOpen((p) => (p === "variant" ? null : "variant"))}
          >
            &#9711;
          </button>
          {open === "variant" ? (
            <VariantPopover
              options={controls.variant.options}
              value={controls.variant.value}
              onPick={(option) => {
                if (controls.variant) commit({ [controls.variant.field]: option })
                setOpen(null)
              }}
            />
          ) : null}
        </div>
      ) : null}
      {controls.columns ? (
        <div className="cn-gutter-control">
          <button
            type="button"
            tabIndex={-1}
            className="cn-gutter-btn cn-gutter-columns"
            aria-label="Columns"
            onClick={() => setOpen((p) => (p === "columns" ? null : "columns"))}
          >
            &#9638;
          </button>
          {open === "columns" ? (
            <ColumnStepper
              value={controls.columns.value}
              min={controls.columns.min}
              max={controls.columns.max}
              onStep={(next) => {
                if (controls.columns) commit({ [controls.columns.field]: next })
              }}
            />
          ) : null}
        </div>
      ) : null}
      {controls.spacing ? (
        <button
          type="button"
          tabIndex={-1}
          className="cn-gutter-btn cn-gutter-spacing"
          aria-label={`Spacing: ${spacingLabel(dragStep ?? controls.spacing.value)}`}
          onPointerDown={startSpacingDrag}
        >
          &#8597;
          <span className="cn-gutter-spacing-label">
            {spacingLabel(dragStep ?? controls.spacing.value)}
          </span>
        </button>
      ) : null}
    </div>
  )
}
