type StepOption = {
  type: string
  label: string
  description: string
  section: "logic" | "action"
}

const STEP_OPTIONS: StepOption[] = [
  {
    type: "condition",
    label: "Condition",
    description: "Branch based on field values",
    section: "logic",
  },
  {
    type: "action.webhook",
    label: "Send Webhook",
    description: "POST data to an external URL",
    section: "action",
  },
  {
    type: "action.email",
    label: "Send Email",
    description: "Send an email notification",
    section: "action",
  },
  {
    type: "action.create_content",
    label: "Create Content",
    description: "Create a new content entry",
    section: "action",
  },
  {
    type: "action.update_content",
    label: "Update Content",
    description: "Update an existing content entry",
    section: "action",
  },
  {
    type: "action.delete_content",
    label: "Delete Content",
    description: "Delete a content entry",
    section: "action",
  },
  {
    type: "action.log",
    label: "Log",
    description: "Write a message to the run log",
    section: "action",
  },
  {
    type: "action.transform",
    label: "Transform",
    description: "Map and reshape data fields",
    section: "action",
  },
]

type Props = {
  onSelect: (type: string) => void
  onCancel: () => void
}

export function StepPicker({ onSelect, onCancel }: Props) {
  const logic = STEP_OPTIONS.filter((o) => o.section === "logic")
  const actions = STEP_OPTIONS.filter((o) => o.section === "action")

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: popover container; handlers only stopPropagation to keep clicks inside the menu from closing it, they are not user actions.
    // biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation guard only, no activatable behavior; the actual options below are real <button>s with keyboard support.
    <div
      className="absolute z-10 mt-1 w-72 bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.08)] shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="p-3 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
        <span className="text-xs font-semibold text-[#71717a] uppercase tracking-wide">
          Add step
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-[#52525b] hover:text-[#a1a1aa] text-sm leading-none"
        >
          ✕
        </button>
      </div>

      <div className="p-2" style={{ maxHeight: "260px", overflowY: "auto" }}>
        <p className="text-xs font-semibold text-[#52525b] uppercase tracking-wide px-2 py-1">
          Logic
        </p>
        {logic.map((opt) => (
          <button
            type="button"
            key={opt.type}
            onClick={() => onSelect(opt.type)}
            className="w-full text-left px-3 py-2 rounded-lg border border-transparent hover:border-[rgba(245,158,11,0.25)] hover:bg-[rgba(245,158,11,0.05)] transition-colors"
          >
            <p className="text-sm font-medium text-[#e4e4e7]">{opt.label}</p>
            <p className="text-xs text-[#71717a]">{opt.description}</p>
          </button>
        ))}

        <p className="text-xs font-semibold text-[#52525b] uppercase tracking-wide px-2 py-1 mt-2">
          Actions
        </p>
        {actions.map((opt) => (
          <button
            type="button"
            key={opt.type}
            onClick={() => onSelect(opt.type)}
            className="w-full text-left px-3 py-2 rounded-lg border border-transparent hover:border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.03)] transition-colors"
          >
            <p className="text-sm font-medium text-[#e4e4e7]">{opt.label}</p>
            <p className="text-xs text-[#71717a]">{opt.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
