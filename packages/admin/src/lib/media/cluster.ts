import type { AdminMediaItem } from "../media"

export type Cluster = {
  key: "images" | "video" | "docs" | "unused"
  label: string
  items: AdminMediaItem[]
}

function typeKey(mimetype: string): "images" | "video" | "docs" {
  if (mimetype.startsWith("image/")) return "images"
  if (mimetype.startsWith("video/")) return "video"
  return "docs"
}

export function clusterAssets(items: AdminMediaItem[], counts: Record<string, number>): Cluster[] {
  const groups: Record<Cluster["key"], AdminMediaItem[]> = {
    images: [],
    video: [],
    docs: [],
    unused: [],
  }

  for (const item of items) {
    groups[typeKey(item.mimetype)].push(item)
    if ((counts[item.id] ?? 0) === 0) groups.unused.push(item)
  }

  return [
    { key: "images", label: "Images", items: groups.images },
    { key: "video", label: "Video", items: groups.video },
    { key: "docs", label: "Documents", items: groups.docs },
    { key: "unused", label: "Unused", items: groups.unused },
  ]
}
