import type React from "react"
import { Folder as FolderIcon, FolderPlus } from "lucide-react"
import type { FolderNode } from "../../lib/media/folders"

export type ActiveFolder = string | null | "all"

export function FolderTree({
  tree,
  active,
  onSelect,
  onCreate,
}: {
  tree: FolderNode[]
  active: ActiveFolder
  onSelect: (id: ActiveFolder) => void
  onCreate: (parentId: string | null) => void
}) {
  const row = (label: string, value: ActiveFolder, depth: number, key: string) => (
    <button
      key={key}
      type="button"
      onClick={() => onSelect(value)}
      style={{ paddingLeft: 8 + depth * 14 }}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
        active === value
          ? "bg-[rgba(201,149,107,0.14)] text-[#fafafa]"
          : "text-[#d4d4d8] hover:bg-[rgba(255,255,255,0.04)]"
      }`}
    >
      <FolderIcon className="h-4 w-4 shrink-0 text-[#c9956b]" />
      <span className="truncate">{label}</span>
    </button>
  )

  const renderNodes = (nodes: FolderNode[], depth: number): React.ReactNode[] =>
    nodes.flatMap((node) => [row(node.name, node.id, depth, node.id), ...renderNodes(node.children, depth + 1)])

  return (
    <nav className="space-y-1" aria-label="Folders">
      <div className="flex items-center justify-between px-2 pb-1">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#71717a]">Folders</span>
        <button type="button" onClick={() => onCreate(null)} aria-label="New folder" className="text-[#71717a] hover:text-[#fafafa]">
          <FolderPlus className="h-4 w-4" />
        </button>
      </div>
      {row("All", "all", 0, "__all")}
      {renderNodes(tree, 0)}
      {row("Unsorted", null, 0, "__unsorted")}
    </nav>
  )
}
