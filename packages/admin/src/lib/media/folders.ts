import type { AdminMediaItem, MediaFolder } from "../media"

export type FolderNode = MediaFolder & { children: FolderNode[] }

export function buildFolderTree(folders: MediaFolder[]): FolderNode[] {
  const nodes = new Map<string, FolderNode>(folders.map((folder) => [folder.id, { ...folder, children: [] }]))
  const roots: FolderNode[] = []

  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const sort = (list: FolderNode[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name))
    list.forEach((node) => sort(node.children))
  }
  sort(roots)
  return roots
}

export function folderPath(folders: MediaFolder[], id: string): MediaFolder[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const path: MediaFolder[] = []
  let current: string | null = id
  const seen = new Set<string>()

  while (current && !seen.has(current)) {
    const folder = byId.get(current)
    if (!folder) break
    path.unshift(folder)
    seen.add(current)
    current = folder.parentId
  }

  return path
}

export function filterByFolder(items: AdminMediaItem[], folderId: string | null | "all"): AdminMediaItem[] {
  if (folderId === "all") return items
  if (folderId === null) return items.filter((item) => !item.folderId)
  return items.filter((item) => item.folderId === folderId)
}
