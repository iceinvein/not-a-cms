export type FrameWidth = "desktop" | "tablet" | "mobile"

const PRESETS: Array<{ value: FrameWidth; label: string }> = [
  { value: "desktop", label: "Desktop" },
  { value: "tablet", label: "Tablet" },
  { value: "mobile", label: "Mobile" },
]

type Props = {
  value: FrameWidth
  onChange: (next: FrameWidth) => void
}

/**
 * Responsive preview width control for the Visual canvas frame. Plain aria-pressed
 * buttons (no role=group/tablist, per the column-stepper accessibility convention).
 */
export function WidthSelector({ value, onChange }: Props) {
  return (
    <div role="toolbar" className="cn-width-selector" aria-label="Preview width">
      {PRESETS.map((preset) => (
        <button
          key={preset.value}
          type="button"
          data-width={preset.value}
          aria-pressed={value === preset.value}
          className={value === preset.value ? "cn-width-btn cn-width-on" : "cn-width-btn"}
          onClick={() => onChange(preset.value)}
        >
          {preset.label}
        </button>
      ))}
    </div>
  )
}
