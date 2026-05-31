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
        <h3 className="text-xs font-semibold text-[#71717a] uppercase tracking-wider px-1">
          Sections
        </h3>
        <button
          onClick={onAddSection}
          className="text-xs text-[#a1a1aa] hover:text-[#fafafa] transition-colors px-2 py-0.5 rounded hover:bg-[rgba(255,255,255,0.05)]"
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
                  ? "bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.1)]"
                  : "border border-transparent hover:bg-[rgba(255,255,255,0.03)]"
              }`}
            >
              <input
                type="text"
                value={section.label || ""}
                placeholder="Untitled section"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onRenameSection(section._id, e.target.value)}
                className="bg-transparent text-sm text-[#a1a1aa] font-medium outline-none flex-1 min-w-0 placeholder:text-[#52525b]"
              />
              <div className="flex items-center gap-1 ml-2 shrink-0">
                <span className="text-xs text-[#52525b]">
                  {section.children.length}
                </span>
                {sections.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveSection(section._id)
                    }}
                    className="text-[#52525b] hover:text-red-400 transition-colors p-0.5 text-xs"
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
