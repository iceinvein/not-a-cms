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
}

export type MediaMetadataInput = Pick<AdminMediaItem, "alt" | "title" | "caption" | "focalX" | "focalY">

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
