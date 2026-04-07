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
    <div
      className="absolute z-10 mt-1 w-72 bg-white rounded-xl border border-gray-200 shadow-lg"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="p-3 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add step</span>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-sm leading-none">✕</button>
      </div>

      <div className="p-2" style={{ maxHeight: '260px', overflowY: 'auto' }}>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 py-1">Logic</p>
        {logic.map((opt) => (
          <button
            key={opt.type}
            onClick={() => onSelect(opt.type)}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-amber-50 transition-colors"
          >
            <p className="text-sm font-medium text-gray-800">{opt.label}</p>
            <p className="text-xs text-gray-500">{opt.description}</p>
          </button>
        ))}

        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 py-1 mt-2">Actions</p>
        {actions.map((opt) => (
          <button
            key={opt.type}
            onClick={() => onSelect(opt.type)}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <p className="text-sm font-medium text-gray-800">{opt.label}</p>
            <p className="text-xs text-gray-500">{opt.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
