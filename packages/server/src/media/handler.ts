import type { MediaMetadataInput, MediaRecord, MediaStorage } from "./storage"

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

    if (req.method === "GET" && !subpath) {
      return json({ data: storage.list().map(toPublicRecord) })
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

    if (req.method === "DELETE" && subpath && !action) {
      const forbidden = await requireManager(req)
      if (forbidden) return forbidden
      const deleted = await storage.remove(subpath)
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
