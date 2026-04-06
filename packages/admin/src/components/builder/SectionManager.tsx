import type { PageSection } from "../../lib/builder-types"

type SectionManagerProps = {
  sections: PageSection[]
  activeSectionId: string | null
  onSelectSection: (id: string) => void
  onAddSection: () => void
  onRemoveSection: (id: string) => void
  onRenameSection: (id: string, label: string) => void
}

export function SectionManager({
  sections,
  activeSectionId,
  onSelectSection,
  onAddSection,
  onRemoveSection,
  onRenameSection,
}: SectionManagerProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
          Sections
        </h3>
        <button
          onClick={onAddSection}
          className="text-xs text-blue-600 hover:text-blue-800 transition-colors px-2 py-0.5 rounded hover:bg-blue-50"
        >
          + Add
        </button>
      </div>

      <div className="space-y-1">
        {sections.map((section) => {
          const isActive = section._id === activeSectionId
          return (
            <div
              key={section._id}
              onClick={() => onSelectSection(section._id)}
              className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                isActive
                  ? "bg-blue-50 border border-blue-200"
                  : "border border-transparent hover:bg-gray-50"
              }`}
            >
              <input
                type="text"
                value={section.label || ""}
                placeholder="Untitled section"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onRenameSection(section._id, e.target.value)}
                className="bg-transparent text-sm text-gray-700 font-medium outline-none flex-1 min-w-0"
              />
              <div className="flex items-center gap-1 ml-2 shrink-0">
                <span className="text-xs text-gray-400">
                  {section.children.length}
                </span>
                {sections.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveSection(section._id)
                    }}
                    className="text-gray-300 hover:text-red-500 transition-colors p-0.5 text-xs"
                    title="Remove section"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
