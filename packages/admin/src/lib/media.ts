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
}

export type MediaMetadataInput = Pick<AdminMediaItem, "alt" | "title" | "caption" | "focalX" | "focalY" | "tags">

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
  const body = await res.json() as { data?: RawMediaRecord[] }
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
  return normalizeMediaRecord(apiBase, await res.json() as RawMediaRecord)
}

export async function updateMediaItem(apiBase: string, id: string, input: Partial<MediaMetadataInput>): Promise<AdminMediaItem> {
  const res = await adminApiFetch(apiBase, `/api/media/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error("Failed to update media")
  return normalizeMediaRecord(apiBase, await res.json() as RawMediaRecord)
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
  const body = await res.json() as { data?: RawMediaRecord[] }
  return (body.data ?? []).map((record) => normalizeMediaRecord(apiBase, record))
}

export type MediaTag = { name: string; color: string; count: number }

export async function listMediaTags(apiBase: string): Promise<MediaTag[]> {
  const res = await adminApiFetch(apiBase, "/api/media/tags")
  if (!res.ok) throw new Error("Failed to load tags")
  const body = await res.json() as { data?: MediaTag[] }
  return body.data ?? []
}

export async function renameMediaTag(apiBase: string, name: string, newName: string): Promise<MediaTag> {
  const res = await adminApiFetch(apiBase, `/api/media/tags/${encodeURIComponent(name)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newName }),
  })
  if (!res.ok) throw new Error("Failed to rename tag")
  return await res.json() as MediaTag
}

export async function setMediaTagColor(apiBase: string, name: string, color: string): Promise<MediaTag> {
  const res = await adminApiFetch(apiBase, `/api/media/tags/${encodeURIComponent(name)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ color }),
  })
  if (!res.ok) throw new Error("Failed to set tag color")
  return await res.json() as MediaTag
}

export async function deleteMediaTag(apiBase: string, name: string): Promise<void> {
  const res = await adminApiFetch(apiBase, `/api/media/tags/${encodeURIComponent(name)}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete tag")
}

export async function replaceMediaFile(apiBase: string, id: string, file: File): Promise<AdminMediaItem> {
  const formData = new FormData()
  formData.append("file", file)

  const res = await adminApiFetch(apiBase, `/api/media/${encodeURIComponent(id)}/replace`, {
    method: "POST",
    body: formData,
  })
  if (!res.ok) throw new Error("Failed to replace media file")
  return normalizeMediaRecord(apiBase, await res.json() as RawMediaRecord)
}

export async function deleteMediaItem(apiBase: string, id: string): Promise<void> {
  const res = await adminApiFetch(apiBase, `/api/media/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete media")
}

export function mediaDisplayUrl(value: unknown, apiBase: string): string {
  if (!value) return ""
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value) || value.startsWith("data:") || value.startsWith("blob:")) return value
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
