import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox"
import { Check } from "lucide-react"
import type { ReactNode } from "react"

type Props = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  id?: string
  label?: ReactNode
  ariaLabel?: string
  disabled?: boolean
}

/**
 * Themed checkbox built on Base UI's headless Checkbox primitive. With a `label`
 * it renders a clickable row; without one it renders just the box (for callers
 * that supply their own label association via `id`).
 */
export function Checkbox({ checked, onCheckedChange, id, label, ariaLabel, disabled }: Props) {
  const box = (
    <BaseCheckbox.Root
      id={id}
      checked={checked}
      onCheckedChange={(next) => onCheckedChange(Boolean(next))}
      disabled={disabled}
      aria-label={label ? undefined : ariaLabel}
      className="cn-checkbox"
    >
      <BaseCheckbox.Indicator className="cn-checkbox-indicator">
        <Check size={12} strokeWidth={3.5} aria-hidden="true" />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  )

  if (!label) return box

  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: control is the nested {box} (BaseCheckbox.Root), which Biome cannot see through the component boundary
    <label className="cn-checkbox-field">
      {box}
      <span className="cn-checkbox-label">{label}</span>
    </label>
  )
}
