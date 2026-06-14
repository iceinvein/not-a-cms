import {
  Archive,
  Bookmark,
  ChevronDown,
  ChevronUp,
  FileText,
  Folder as FolderIcon,
  FolderPlus,
  Heart,
  Image as ImageIcon,
  Lock,
  Star,
  Video,
} from "lucide-react"
import type React from "react"
import type { FolderNode } from "../../lib/media/folders"

export type ActiveFolder = string | null | "all"

// Curated folder glyph set. Keys are validated by format only on the server, so
// this map is the single source of truth for the choices; unknown keys fall back
// to the default folder glyph.
export const FOLDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  folder: FolderIcon,
  image: ImageIcon,
  video: Video,
  "file-text": FileText,
  star: Star,
  heart: Heart,
  bookmark: Bookmark,
  archive: Archive,
}

export const FOLDER_ICON_KEYS = Object.keys(FOLDER_ICONS)

function folderGlyph(icon: string | undefined): React.ComponentType<{ className?: string }> {
  return (icon && FOLDER_ICONS[icon]) || FolderIcon
}

export function FolderTree({
  tree,
  active,
  onSelect,
  onCreate,
  onDropAssets,
  onReorder,
}: {
  tree: FolderNode[]
  active: ActiveFolder
  onSelect: (id: ActiveFolder) => void
  onCreate: (parentId: string | null) => void
  onDropAssets: (folderId: string | null) => void
  onReorder: (id: string, direction: "up" | "down") => void
}) {
  const dropProps = (folderId: string | null) => ({
    onDragOver: (event: React.DragEvent) => {
      event.preventDefault()
      event.currentTarget.classList.add("ring-1", "ring-[#c6ff3d]")
    },
    onDragLeave: (event: React.DragEvent) => {
      event.currentTarget.classList.remove("ring-1", "ring-[#c6ff3d]")
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault()
      event.currentTarget.classList.remove("ring-1", "ring-[#c6ff3d]")
      onDropAssets(folderId)
    },
  })

  const folderRow = (node: FolderNode, depth: number) => {
    const Glyph = folderGlyph(node.icon)
    return (
      <div
        key={node.id}
        className="group/folder relative flex items-center rounded-md"
        {...dropProps(node.id)}
      >
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          style={{ paddingLeft: 8 + depth * 14 }}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
            active === node.id
              ? "bg-[rgba(198,255,61,0.14)] text-[#fafafa]"
              : "text-[#d4d4d8] hover:bg-[rgba(255,255,255,0.04)]"
          }`}
        >
          <Glyph className="h-4 w-4 shrink-0" />
          <span className="truncate" style={{ color: node.color }}>
            {node.name}
          </span>
          {node.roles && node.roles.length > 0 && (
            <Lock className="ml-1 h-3 w-3 shrink-0 text-[#909099]" aria-label="Restricted" />
          )}
        </button>
        <span className="absolute right-1 hidden gap-0.5 group-hover/folder:flex">
          <button
            type="button"
            aria-label={`Move ${node.name} up`}
            onClick={() => onReorder(node.id, "up")}
            className="text-[#909099] hover:text-[#fafafa]"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label={`Move ${node.name} down`}
            onClick={() => onReorder(node.id, "down")}
            className="text-[#909099] hover:text-[#fafafa]"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
    )
  }

  const simpleRow = (
    label: string,
    value: ActiveFolder,
    key: string,
    drop: string | null | false,
  ) => (
    <button
      key={key}
      type="button"
      onClick={() => onSelect(value)}
      {...(drop !== false ? dropProps(drop) : {})}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
        active === value
          ? "bg-[rgba(198,255,61,0.14)] text-[#fafafa]"
          : "text-[#d4d4d8] hover:bg-[rgba(255,255,255,0.04)]"
      }`}
    >
      <FolderIcon className="h-4 w-4 shrink-0 text-[#909099]" />
      <span className="truncate">{label}</span>
    </button>
  )

  const renderNodes = (nodes: FolderNode[], depth: number): React.ReactNode[] =>
    nodes.flatMap((node) => [folderRow(node, depth), ...renderNodes(node.children, depth + 1)])

  return (
    <nav className="space-y-1" aria-label="Folders">
      <div className="flex items-center justify-between px-2 pb-1">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#909099]">
          Folders
        </span>
        <button
          type="button"
          onClick={() => onCreate(null)}
          aria-label="New folder"
          className="text-[#909099] hover:text-[#fafafa]"
        >
          <FolderPlus className="h-4 w-4" />
        </button>
      </div>
      {simpleRow("All", "all", "__all", false)}
      {renderNodes(tree, 0)}
      {simpleRow("Unsorted", null, "__unsorted", null)}
    </nav>
  )
}
