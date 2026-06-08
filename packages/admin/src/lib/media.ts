import { adminApiFetch, joinAdminApiUrl } from "./api"

export type AdminMediaItem = {
  id: string
  filename: string
  mimetype: string
  size: number
  uploadedAt: string
  url: string
  width?: number
  height?: number
  blurDataURL?: string
  variants?: Array<{ width: number; format: string; path: string }>
  alt?: string
  title?: string
  caption?: string
  focalX?: number
  focalY?: number
  tags?: string[]
  folderId?: string
}

export type MediaMetadataInput = Pick<
  AdminMediaItem,
  "alt" | "title" | "caption" | "focalX" | "focalY" | "tags"
>
export type MediaFolder = {
  id: string
  name: string
  parentId: string | null
  position?: number
  color?: string
  icon?: string
  roles?: string[]
}

export type MediaContext = { role: string | null; roles: { key: string; label: string }[] }

type RawMediaRecord = Omit<AdminMediaItem, "url"> & {
  url?: string
  path?: string
}

function absoluteUrl(apiBase: string, url: string): string {
  if (/^https?:\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) return url
  return joinAdminApiUrl(apiBase, url)
}

function normalizeMediaRecord(apiBase: string, record: RawMediaRecord): AdminMediaItem {
  const url = record.url || `/api/media/${record.id}/file`
  const { path: _path, ...rest } = record
  return {
    ...rest,
    url: absoluteUrl(apiBase, url),
  }
}

export async function listMediaItems(apiBase: string): Promise<AdminMediaItem[]> {
  const res = await adminApiFetch(apiBase, "/api/media")
  if (!res.ok) throw new Error("Failed to load media")
  const body = (await res.json()) as { data?: RawMediaRecord[] }
  return (body.data ?? []).map((record) => normalizeMediaRecord(apiBase, record))
}

export async function uploadMediaFile(apiBase: string, file: File): Promise<AdminMediaItem> {
  const formData = new FormData()
  formData.append("file", file)

  const res = await adminApiFetch(apiBase, "/api/media/upload", {
    method: "POST",
    body: formData,
  })
  if (!res.ok) throw new Error("Failed to upload media")
  return normalizeMediaRecord(apiBase, (await res.json()) as RawMediaRecord)
}

export async function updateMediaItem(
  apiBase: string,
  id: string,
  input: Partial<MediaMetadataInput>,
): Promise<AdminMediaItem> {
  const res = await adminApiFetch(apiBase, `/api/media/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error("Failed to update media")
  return normalizeMediaRecord(apiBase, (await res.json()) as RawMediaRecord)
}

export async function bulkUpdateMediaTags(
  apiBase: string,
  input: { ids: string[]; add?: string[]; remove?: string[] },
): Promise<AdminMediaItem[]> {
  const res = await adminApiFetch(apiBase, "/api/media/tags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error("Failed to update tags")
  const body = (await res.json()) as { data?: RawMediaRecord[] }
  return (body.data ?? []).map((record) => normalizeMediaRecord(apiBase, record))
}

export type MediaTag = {
  name: string
  color: string
  count: number
  description?: string
  group?: string
}

export async function listMediaTags(apiBase: string): Promise<MediaTag[]> {
  const res = await adminApiFetch(apiBase, "/api/media/tags")
  if (!res.ok) throw new Error("Failed to load tags")
  const body = (await res.json()) as { data?: MediaTag[] }
  return body.data ?? []
}

export async function renameMediaTag(
  apiBase: string,
  name: string,
  newName: string,
): Promise<MediaTag> {
  const res = await adminApiFetch(apiBase, `/api/media/tags/${encodeURIComponent(name)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newName }),
  })
  if (!res.ok) throw new Error("Failed to rename tag")
  return (await res.json()) as MediaTag
}

export async function setMediaTagColor(
  apiBase: string,
  name: string,
  color: string,
): Promise<MediaTag> {
  const res = await adminApiFetch(apiBase, `/api/media/tags/${encodeURIComponent(name)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ color }),
  })
  if (!res.ok) throw new Error("Failed to set tag color")
  return (await res.json()) as MediaTag
}

export async function setMediaTagDescription(
  apiBase: string,
  name: string,
  description: string | null,
): Promise<MediaTag> {
  const res = await adminApiFetch(apiBase, `/api/media/tags/${encodeURIComponent(name)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  })
  if (!res.ok) throw new Error("Failed to set tag description")
  return (await res.json()) as MediaTag
}

export async function setMediaTagGroup(
  apiBase: string,
  name: string,
  group: string | null,
): Promise<MediaTag> {
  const res = await adminApiFetch(apiBase, `/api/media/tags/${encodeURIComponent(name)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ group }),
  })
  if (!res.ok) throw new Error("Failed to set tag group")
  return (await res.json()) as MediaTag
}

export async function mergeMediaTag(
  apiBase: string,
  source: string,
  target: string,
): Promise<number> {
  const res = await adminApiFetch(apiBase, "/api/media/tags/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, target }),
  })
  if (!res.ok) throw new Error("Failed to merge tags")
  const body = (await res.json()) as { merged?: number }
  return body.merged ?? 0
}

export async function deleteMediaTag(apiBase: string, name: string): Promise<void> {
  const res = await adminApiFetch(apiBase, `/api/media/tags/${encodeURIComponent(name)}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete tag")
}

export async function listMediaFolders(apiBase: string): Promise<MediaFolder[]> {
  const res = await adminApiFetch(apiBase, "/api/media/folders")
  if (!res.ok) throw new Error("Failed to load folders")
  const body = (await res.json()) as { data?: MediaFolder[] }
  return body.data ?? []
}

export async function createMediaFolder(
  apiBase: string,
  name: string,
  parentId: string | null,
): Promise<MediaFolder> {
  const res = await adminApiFetch(apiBase, "/api/media/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, parentId }),
  })
  if (!res.ok) throw new Error("Failed to create folder")
  return (await res.json()) as MediaFolder
}

export async function renameMediaFolder(
  apiBase: string,
  id: string,
  name: string,
): Promise<MediaFolder> {
  const res = await adminApiFetch(apiBase, `/api/media/folders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error("Failed to rename folder")
  return (await res.json()) as MediaFolder
}

export async function moveMediaFolder(
  apiBase: string,
  id: string,
  parentId: string | null,
): Promise<MediaFolder> {
  const res = await adminApiFetch(apiBase, `/api/media/folders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parentId }),
  })
  if (!res.ok) throw new Error("Failed to move folder")
  return (await res.json()) as MediaFolder
}

export async function setMediaFolderColor(
  apiBase: string,
  id: string,
  color: string | null,
): Promise<MediaFolder> {
  const res = await adminApiFetch(apiBase, `/api/media/folders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ color }),
  })
  if (!res.ok) throw new Error("Failed to set folder color")
  return (await res.json()) as MediaFolder
}

export async function setMediaFolderIcon(
  apiBase: string,
  id: string,
  icon: string | null,
): Promise<MediaFolder> {
  const res = await adminApiFetch(apiBase, `/api/media/folders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ icon }),
  })
  if (!res.ok) throw new Error("Failed to set folder icon")
  return (await res.json()) as MediaFolder
}

export async function reorderMediaFolder(
  apiBase: string,
  id: string,
  direction: "up" | "down",
): Promise<MediaFolder> {
  const res = await adminApiFetch(apiBase, `/api/media/folders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ direction }),
  })
  if (!res.ok) throw new Error("Failed to reorder folder")
  return (await res.json()) as MediaFolder
}

export async function setMediaFolderRoles(
  apiBase: string,
  id: string,
  roles: string[] | null,
): Promise<MediaFolder> {
  const res = await adminApiFetch(apiBase, `/api/media/folders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roles }),
  })
  if (!res.ok) throw new Error("Failed to set folder roles")
  return (await res.json()) as MediaFolder
}

export async function getMediaContext(apiBase: string): Promise<MediaContext> {
  const res = await adminApiFetch(apiBase, "/api/media/context")
  if (!res.ok) throw new Error("Failed to load media context")
  return (await res.json()) as MediaContext
}

export async function deleteMediaFolder(
  apiBase: string,
  id: string,
): Promise<{ reassigned: number; reparented: number }> {
  const res = await adminApiFetch(apiBase, `/api/media/folders/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete folder")
  return (await res.json()) as { reassigned: number; reparented: number }
}

export async function moveMediaAssets(
  apiBase: string,
  ids: string[],
  folderId: string | null,
): Promise<AdminMediaItem[]> {
  const res = await adminApiFetch(apiBase, "/api/media/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, folderId }),
  })
  if (!res.ok) throw new Error("Failed to move assets")
  const body = (await res.json()) as { data?: RawMediaRecord[] }
  return (body.data ?? []).map((record) => normalizeMediaRecord(apiBase, record))
}

export async function replaceMediaFile(
  apiBase: string,
  id: string,
  file: File,
): Promise<AdminMediaItem> {
  const formData = new FormData()
  formData.append("file", file)

  const res = await adminApiFetch(apiBase, `/api/media/${encodeURIComponent(id)}/replace`, {
    method: "POST",
    body: formData,
  })
  if (!res.ok) throw new Error("Failed to replace media file")
  return normalizeMediaRecord(apiBase, (await res.json()) as RawMediaRecord)
}

export async function deleteMediaItem(apiBase: string, id: string): Promise<void> {
  const res = await adminApiFetch(apiBase, `/api/media/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete media")
}

export async function bulkDeleteMediaItems(apiBase: string, ids: string[]): Promise<string[]> {
  const res = await adminApiFetch(apiBase, "/api/media/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) throw new Error("Failed to delete media")
  const body = (await res.json()) as { deleted?: string[] }
  return body.deleted ?? []
}

export function mediaDisplayUrl(value: unknown, apiBase: string): string {
  if (!value) return ""
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value) || value.startsWith("data:") || value.startsWith("blob:"))
      return value
    return joinAdminApiUrl(apiBase, value)
  }
  if (typeof value === "object") {
    const record = value as { id?: string; url?: string }
    if (record.url) return absoluteUrl(apiBase, record.url)
    if (record.id) return joinAdminApiUrl(apiBase, `/api/media/${record.id}/file`)
  }
  return ""
}

const MAX_TAG_LENGTH = 25

export function normalizeTagInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^#+\s*/, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_TAG_LENGTH)
    .replace(/-+$/g, "")
}
