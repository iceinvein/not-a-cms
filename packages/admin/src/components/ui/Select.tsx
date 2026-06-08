import { Select as BaseSelect } from "@base-ui/react/select"
import { Check, ChevronDown } from "lucide-react"

export type SelectOption = { value: string; label: string }

type Props = {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  id?: string
  placeholder?: string
  ariaLabel?: string
  disabled?: boolean
}

/**
 * Themed dropdown built on Base UI's headless Select primitive. Renders a real
 * web popover (keyboard nav, typeahead, portal positioning handled by Base UI)
 * styled with the admin's design tokens instead of the native OS option list.
 */
export function Select({ value, onValueChange, options, id, placeholder = "Select…", ariaLabel, disabled }: Props) {
  return (
    <BaseSelect.Root
      value={value}
      onValueChange={(next) => onValueChange(next == null ? "" : String(next))}
      disabled={disabled}
    >
      <BaseSelect.Trigger id={id} className="cn-select-trigger" aria-label={ariaLabel}>
        <BaseSelect.Value className="cn-select-value" placeholder={placeholder}>
          {(current) => options.find((opt) => opt.value === current)?.label ?? placeholder}
        </BaseSelect.Value>
        <BaseSelect.Icon className="cn-select-icon">
          <ChevronDown size={14} aria-hidden="true" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner className="cn-select-positioner" sideOffset={6} alignItemWithTrigger={false}>
          <BaseSelect.Popup className="cn-select-popup">
            {options.map((opt) => (
              <BaseSelect.Item key={opt.value} value={opt.value} className="cn-select-item">
                <BaseSelect.ItemText className="cn-select-item-text">{opt.label}</BaseSelect.ItemText>
                <BaseSelect.ItemIndicator className="cn-select-item-indicator">
                  <Check size={14} aria-hidden="true" />
                </BaseSelect.ItemIndicator>
              </BaseSelect.Item>
            ))}
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  )
}
