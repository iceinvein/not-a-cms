import type { AdminMediaItem, MediaFolder } from "../media"

export type FolderNode = MediaFolder & { children: FolderNode[] }

export function buildFolderTree(folders: MediaFolder[]): FolderNode[] {
  const nodes = new Map<string, FolderNode>(
    folders.map((folder) => [folder.id, { ...folder, children: [] }]),
  )
  const roots: FolderNode[] = []

  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const sort = (list: FolderNode[]) => {
    list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name))
    for (const node of list) sort(node.children)
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

export function filterByFolder(
  items: AdminMediaItem[],
  folderId: string | null | "all",
): AdminMediaItem[] {
  if (folderId === "all") return items
  if (folderId === null) return items.filter((item) => !item.folderId)
  return items.filter((item) => item.folderId === folderId)
}

// The folder id plus all transitive descendant ids, for the "include subfolders" view.
export function folderDescendantIds(folders: MediaFolder[], id: string): Set<string> {
  const childrenByParent = new Map<string | null, MediaFolder[]>()
  for (const folder of folders) {
    const siblings = childrenByParent.get(folder.parentId) ?? []
    siblings.push(folder)
    childrenByParent.set(folder.parentId, siblings)
  }
  const ids = new Set<string>([id])
  const stack = [id]
  while (stack.length > 0) {
    const current = stack.pop()!
    for (const child of childrenByParent.get(current) ?? []) {
      if (!ids.has(child.id)) {
        ids.add(child.id)
        stack.push(child.id)
      }
    }
  }
  return ids
}
