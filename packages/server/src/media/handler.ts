import { applyTagOps, type MediaMetadataInput, type MediaRecord, type MediaStorage } from "./storage"

type PublicMediaRecord = Omit<MediaRecord, "path"> & {
  url: string
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function toPublicRecord(record: MediaRecord): PublicMediaRecord {
  const { path: _path, ...publicRecord } = record
  return {
    ...publicRecord,
    variants: record.variants?.map((variant) => ({
      ...variant,
      path: `/api/media/${record.id}/file?w=${variant.width}&format=${variant.format}`,
    })),
    url: `/api/media/${record.id}/file`,
  }
}

type MediaHandlerOptions = {
  canManage?: (req: Request) => boolean | Promise<boolean>
  onAssetsDeleted?: (ids: string[]) => void
}

export function createMediaHandler(storage: MediaStorage, options: MediaHandlerOptions = {}) {
  return async function handleMedia(req: Request): Promise<Response | null> {
    const url = new URL(req.url)
    if (!url.pathname.startsWith("/api/media")) return null

    const parts = url.pathname.replace("/api/media", "").split("/").filter(Boolean)
    const subpath = parts[0]
    const action = parts[1]

    if (req.method === "POST" && (subpath === "upload" || !subpath)) {
      const forbidden = await requireManager(req)
      if (forbidden) return forbidden
      const formData = await req.formData()
      const file = formData.get("file") as File | null
      if (!file) return json({ error: "No file provided" }, 400)
      const record = await storage.store(file, metadataFromFormData(formData))
      return json(toPublicRecord(record), 201)
    }

    if (req.method === "POST" && subpath === "tags" && !action) {
      const forbidden = await requireManager(req)
      if (forbidden) return forbidden
      const body = await req.json().catch(() => null)
      if (!isRecord(body) || !Array.isArray(body.ids) || body.ids.some((id) => typeof id !== "string") || body.ids.length === 0) {
        return json({ error: "ids must be a non-empty array of strings" }, 400)
      }
      const add = Array.isArray(body.add) ? body.add.map(String) : []
      const remove = Array.isArray(body.remove) ? body.remove.map(String) : []
      const updated: MediaRecord[] = []
      for (const id of body.ids as string[]) {
        const record = storage.get(id)
        if (!record) continue
        const next = storage.update(id, { tags: applyTagOps(record.tags ?? [], add, remove) })
        if (next) updated.push(next)
      }
      return json({ data: updated.map(toPublicRecord) })
    }

    if (req.method === "POST" && subpath === "tags" && action === "merge") {
      const forbidden = await requireManager(req)
      if (forbidden) return forbidden
      const body = await req.json().catch(() => null)
      if (!isRecord(body) || typeof body.source !== "string" || !body.source.trim() || typeof body.target !== "string" || !body.target.trim()) {
        return json({ error: "source and target are required" }, 400)
      }
      return json({ merged: storage.mergeTag(body.source, body.target) })
    }

    if (req.method === "POST" && subpath === "delete" && !action) {
      const forbidden = await requireManager(req)
      if (forbidden) return forbidden
      const body = await req.json().catch(() => null)
      if (!isRecord(body) || !Array.isArray(body.ids) || body.ids.some((id) => typeof id !== "string")) {
        return json({ error: "ids must be an array of strings" }, 400)
      }
      const deleted: string[] = []
      for (const id of body.ids as string[]) {
        if (await storage.remove(id)) deleted.push(id)
      }
      if (deleted.length > 0) options.onAssetsDeleted?.(deleted)
      return json({ deleted })
    }

    if (req.method === "GET" && !subpath) {
      return json({ data: storage.list().map(toPublicRecord) })
    }

    if (req.method === "GET" && subpath === "tags" && !action) {
      return json({ data: storage.listTags() })
    }

    if (req.method === "GET" && subpath === "folders" && !action) {
      return json({ data: storage.listFolders() })
    }

    if (req.method === "POST" && subpath === "folders" && !action) {
      const forbidden = await requireManager(req)
      if (forbidden) return forbidden
      const body = await req.json().catch(() => null)
      if (!isRecord(body) || typeof body.name !== "string" || !body.name.trim()) return json({ error: "name is required" }, 400)
      const parentId = body.parentId === undefined ? null : body.parentId
      if (parentId !== null && typeof parentId !== "string") return json({ error: "parentId must be a string or null" }, 400)
      try {
        return json(storage.createFolder(body.name, parentId), 201)
      } catch {
        return json({ error: "parent not found" }, 400)
      }
    }

    if (req.method === "PATCH" && subpath === "folders" && action) {
      const forbidden = await requireManager(req)
      if (forbidden) return forbidden
      const body = await req.json().catch(() => null)
      if (!isRecord(body)) return json({ error: "Body must be an object" }, 400)
      let folder = storage.listFolders().find((entry) => entry.id === action) ?? null
      if (!folder) return json({ error: "Not found" }, 404)
      if (typeof body.name === "string" && body.name.trim()) folder = storage.renameFolder(action, body.name)
      if (body.parentId !== undefined) {
        const parentId = body.parentId === null ? null : body.parentId
        if (parentId !== null && typeof parentId !== "string") return json({ error: "parentId must be a string or null" }, 400)
        try {
          folder = storage.moveFolder(action, parentId)
        } catch {
          return json({ error: "invalid move" }, 400)
        }
      }
      if (body.color !== undefined) {
        if (body.color !== null && (typeof body.color !== "string" || !/^#[0-9a-f]{6}$/i.test(body.color))) {
          return json({ error: "color must be a #rrggbb hex or null" }, 400)
        }
        folder = storage.setFolderColor(action, body.color)
      }
      if (body.icon !== undefined) {
        if (body.icon !== null && (typeof body.icon !== "string" || !/^[a-z][a-z0-9-]{0,23}$/.test(body.icon))) {
          return json({ error: "icon must be a short lowercase key or null" }, 400)
        }
        folder = storage.setFolderIcon(action, body.icon)
      }
      if (body.direction !== undefined) {
        if (body.direction !== "up" && body.direction !== "down") {
          return json({ error: "direction must be up or down" }, 400)
        }
        folder = storage.reorderFolder(action, body.direction)
      }
      return json(folder)
    }

    if (req.method === "DELETE" && subpath === "folders" && action) {
      const forbidden = await requireManager(req)
      if (forbidden) return forbidden
      const result = storage.removeFolder(action)
      if (!result) return json({ error: "Not found" }, 404)
      return json(result)
    }

    if (req.method === "POST" && subpath === "move" && !action) {
      const forbidden = await requireManager(req)
      if (forbidden) return forbidden
      const body = await req.json().catch(() => null)
      if (!isRecord(body) || !Array.isArray(body.ids) || body.ids.some((id) => typeof id !== "string")) {
        return json({ error: "ids must be an array of strings" }, 400)
      }
      const folderId = body.folderId === undefined ? null : body.folderId
      if (folderId !== null && typeof folderId !== "string") return json({ error: "folderId must be a string or null" }, 400)
      try {
        return json({ data: storage.moveAssets(body.ids as string[], folderId).map(toPublicRecord) })
      } catch {
        return json({ error: "folder not found" }, 400)
      }
    }

    if (req.method === "GET" && subpath && action === "file") {
      const variantOptions = validateVariantRequest(url)
      if (variantOptions instanceof Response) return variantOptions
      const file = await storage.getFile(subpath, variantOptions)
      if (!file) return json({ error: "Not found" }, 404)
      const headers = new Headers()
      if (file.mimetype) headers.set("Content-Type", file.mimetype)
      headers.set("Content-Disposition", `inline; filename="${file.filename.replace(/"/g, "")}"`)
      return new Response(file.body, { headers })
    }

    if (req.method === "POST" && subpath && action === "replace") {
      const forbidden = await requireManager(req)
      if (forbidden) return forbidden
      const formData = await req.formData()
      const file = formData.get("file") as File | null
      if (!file) return json({ error: "No file provided" }, 400)
      const record = await storage.replaceFile(subpath, file)
      if (!record) return json({ error: "Not found" }, 404)
      return json(toPublicRecord(record))
    }

    if (req.method === "PATCH" && subpath === "tags" && action) {
      const forbidden = await requireManager(req)
      if (forbidden) return forbidden
      const name = decodeURIComponent(action)
      const body = await req.json().catch(() => null)
      if (!isRecord(body)) return json({ error: "Body must be an object" }, 400)
      let finalName = normalizeName(name)
      if (body.color !== undefined) {
        if (typeof body.color !== "string" || !/^#[0-9a-f]{6}$/i.test(body.color)) return json({ error: "color must be a #rrggbb hex" }, 400)
        storage.setTagColor(name, body.color)
      }
      if (body.description !== undefined) {
        if (body.description !== null && typeof body.description !== "string") return json({ error: "description must be a string or null" }, 400)
        storage.setTagDescription(name, body.description)
      }
      if (body.group !== undefined) {
        if (body.group !== null && typeof body.group !== "string") return json({ error: "group must be a string or null" }, 400)
        storage.setTagGroup(name, body.group)
      }
      if (body.newName !== undefined) {
        if (typeof body.newName !== "string") return json({ error: "newName must be a non-empty string" }, 400)
        const normalized = normalizeName(body.newName)
        if (!normalized) return json({ error: "newName must be a non-empty string" }, 400)
        storage.renameTag(name, body.newName)
        finalName = normalized
      }
      const entry = storage.listTags().find((tag) => tag.name === finalName) ?? { name: finalName, color: storage.tagColors()[finalName] ?? "#c9956b", count: 0 }
      return json(entry)
    }

    if (req.method === "GET" && subpath && !action) {
      const record = storage.get(subpath)
      if (!record) return json({ error: "Not found" }, 404)
      return json(toPublicRecord(record))
    }

    if (req.method === "PATCH" && subpath && !action) {
      const forbidden = await requireManager(req)
      if (forbidden) return forbidden
      const body = await req.json().catch(() => null)
      if (!isRecord(body)) return json({ error: "Media metadata must be an object" }, 400)
      const metadata = metadataFromRecord(body)
      const validationError = validateMetadata(metadata)
      if (validationError) return json({ error: validationError }, 400)
      const record = storage.update(subpath, metadata)
      if (!record) return json({ error: "Not found" }, 404)
      return json(toPublicRecord(record))
    }

    if (req.method === "DELETE" && subpath === "tags" && action) {
      const forbidden = await requireManager(req)
      if (forbidden) return forbidden
      return json({ removed: storage.removeTag(decodeURIComponent(action)) })
    }

    if (req.method === "DELETE" && subpath && !action) {
      const forbidden = await requireManager(req)
      if (forbidden) return forbidden
      const deleted = await storage.remove(subpath)
      if (deleted) options.onAssetsDeleted?.([subpath])
      return json({ deleted })
    }

    return json({ error: "Method not allowed" }, 405)
  }

  async function requireManager(req: Request): Promise<Response | null> {
    if (!options.canManage) return null
    return await options.canManage(req) ? null : json({ error: "Forbidden" }, 403)
  }
}

function metadataFromFormData(formData: FormData): Partial<MediaMetadataInput> {
  return metadataFromRecord({
    alt: formData.get("alt"),
    title: formData.get("title"),
    caption: formData.get("caption"),
    focalX: formData.get("focalX"),
    focalY: formData.get("focalY"),
  })
}

function metadataFromRecord(input: Record<string, unknown>): Partial<MediaMetadataInput> {
  return {
    ...(input.alt !== undefined && input.alt !== null && { alt: String(input.alt) }),
    ...(input.title !== undefined && input.title !== null && { title: String(input.title) }),
    ...(input.caption !== undefined && input.caption !== null && { caption: String(input.caption) }),
    ...(input.focalX !== undefined && input.focalX !== null && { focalX: Number(input.focalX) }),
    ...(input.focalY !== undefined && input.focalY !== null && { focalY: Number(input.focalY) }),
    ...(input.tags !== undefined && input.tags !== null && { tags: input.tags as string[] }),
  }
}

function validateMetadata(input: Partial<MediaMetadataInput>): string | null {
  for (const [key, value] of Object.entries(input)) {
    if ((key === "alt" || key === "title" || key === "caption") && typeof value !== "string") {
      return `${key} must be a string`
    }
    if ((key === "focalX" || key === "focalY") && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)) {
      return `${key} must be a number between 0 and 1`
    }
    if (key === "tags" && (!Array.isArray(value) || value.some((entry) => typeof entry !== "string"))) {
      return "tags must be an array of strings"
    }
  }
  return null
}

function validateVariantRequest(url: URL): { width?: number; format?: "webp" | "avif" } | Response {
  const widthValue = url.searchParams.get("w")
  const formatValue = url.searchParams.get("format")
  if (!widthValue && !formatValue) return {}
  if (!widthValue || !formatValue) return json({ error: "Both w and format are required for media variants" }, 400)

  const width = Number(widthValue)
  if (!Number.isInteger(width) || width < 16 || width > 3840) {
    return json({ error: "w must be an integer between 16 and 3840" }, 400)
  }
  if (formatValue !== "webp" && formatValue !== "avif") {
    return json({ error: "format must be webp or avif" }, 400)
  }

  return { width, format: formatValue }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^#+\s*/, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 25)
    .replace(/-+$/g, "")
}
