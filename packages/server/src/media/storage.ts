import { mkdirSync, existsSync, unlinkSync, rmSync, readFileSync, writeFileSync } from "node:fs"
import { createHash, createHmac } from "node:crypto"
import { join } from "node:path"
import type { ImageOptimizer, ImageVariant, VariantFormat } from "./optimizer"

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export type LocalStorageConfig = {
  provider: "local"
  path: string
}

export type S3StorageConfig = {
  provider: "s3" | "r2"
  path?: string
  bucket?: string
  endpoint?: string
  region?: string
  accessKeyId?: string
  secretAccessKey?: string
  publicUrl?: string
  prefix?: string
  fetch?: FetchLike
}

export type StorageConfig = LocalStorageConfig | S3StorageConfig

export type MediaRecord = {
  id: string
  filename: string
  mimetype: string
  size: number
  path: string
  uploadedAt: string
  width?: number
  height?: number
  blurDataURL?: string
  variants?: ImageVariant[]
  alt?: string
  title?: string
  caption?: string
  focalX?: number
  focalY?: number
  tags?: string[]
}

export type MediaMetadataInput = Pick<MediaRecord, "alt" | "title" | "caption" | "focalX" | "focalY" | "tags">

export type StoredMediaFile = {
  body: Blob
  filename: string
  mimetype: string
}

export type MediaFileOptions = {
  width?: number
  format?: VariantFormat
}

export type MediaStorage = {
  store(file: File, metadata?: Partial<MediaMetadataInput>): Promise<MediaRecord>
  list(): MediaRecord[]
  get(id: string): MediaRecord | null
  getFile(id: string, options?: MediaFileOptions): Promise<StoredMediaFile | null>
  update(id: string, metadata: Partial<MediaMetadataInput>): MediaRecord | null
  replaceFile(id: string, file: File): Promise<MediaRecord | null>
  remove(id: string): Promise<boolean>
}

type ObjectProvider = {
  put(key: string, file: File): Promise<{ path: string; localPath?: string }>
  get(path: string): Promise<Blob | null>
  delete(path: string): Promise<void>
}

type S3SignedRequestInput = {
  method: string
  endpoint: string
  bucket: string
  region: string
  key: string
  accessKeyId: string
  secretAccessKey: string
  date?: Date
  headers?: Record<string, string>
  payloadHash?: string
}

export type S3SignedRequest = {
  url: string
  headers: Record<string, string>
}

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "image/svg+xml"])

export function createLocalStorage(config: LocalStorageConfig, optimizer?: ImageOptimizer): MediaStorage {
  return createIndexedMediaStorage(config, createLocalObjectProvider(config.path), optimizer)
}

export function createMediaStorage(config: StorageConfig, optimizer?: ImageOptimizer): MediaStorage {
  if (config.provider === "local") return createLocalStorage(config, optimizer)
  return createIndexedMediaStorage(config, createS3ObjectProvider(config), optimizer)
}

function createIndexedMediaStorage(config: StorageConfig, provider: ObjectProvider, optimizer?: ImageOptimizer): MediaStorage {
  const indexDir = config.provider === "local" ? config.path : config.path ?? "./uploads"
  if (!existsSync(indexDir)) mkdirSync(indexDir, { recursive: true })

  const indexPath = join(indexDir, ".media-index.json")
  const records = loadIndex(indexPath)

  function persistIndex() {
    const data = JSON.stringify(Array.from(records.values()), null, 2)
    writeFileSync(indexPath, data + "\n")
  }

  return {
    async store(file: File, metadata: Partial<MediaMetadataInput> = {}): Promise<MediaRecord> {
      const id = crypto.randomUUID()
      const record = await buildRecord(id, file, {
        uploadedAt: new Date().toISOString(),
        ...normalizeMetadata(metadata),
      })
      records.set(id, record)
      persistIndex()
      return record
    },

    list(): MediaRecord[] {
      return Array.from(records.values())
    },

    get(id: string): MediaRecord | null {
      return records.get(id) ?? null
    },

    async getFile(id: string, options: MediaFileOptions = {}): Promise<StoredMediaFile | null> {
      const record = records.get(id)
      if (!record) return null
      if (options.width && options.format) {
        const variant = await getVariant(record, options.width, options.format)
        if (!variant) return null
        const body = await provider.get(variant.path)
        if (!body) return null
        return {
          body,
          filename: variant.path.split("/").pop() ?? record.filename,
          mimetype: `image/${options.format}`,
        }
      }
      const body = await provider.get(record.path)
      if (!body) return null
      return {
        body,
        filename: record.filename,
        mimetype: record.mimetype,
      }
    },

    update(id: string, metadata: Partial<MediaMetadataInput>): MediaRecord | null {
      const record = records.get(id)
      if (!record) return null
      const updated = { ...record, ...normalizeMetadata(metadata) }
      records.set(id, updated)
      persistIndex()
      return updated
    },

    async replaceFile(id: string, file: File): Promise<MediaRecord | null> {
      const existing = records.get(id)
      if (!existing) return null
      await provider.delete(existing.path)
      try { rmSync(join(indexDir, id), { recursive: true }) } catch {}
      const record = await buildRecord(id, file, {
        uploadedAt: new Date().toISOString(),
        ...normalizeMetadata(existing),
      })
      records.set(id, record)
      persistIndex()
      return record
    },

    async remove(id: string): Promise<boolean> {
      const record = records.get(id)
      if (!record) return false
      await provider.delete(record.path)
      try { rmSync(join(indexDir, id), { recursive: true }) } catch {}
      records.delete(id)
      persistIndex()
      return true
    },
  }

  async function buildRecord(id: string, file: File, base: Pick<MediaRecord, "uploadedAt"> & Partial<MediaMetadataInput>): Promise<MediaRecord> {
    const ext = file.name.split(".").pop() || ""
    const storedName = `${id}${ext ? "." + ext : ""}`
    const stored = await provider.put(storedName, file)

    const record: MediaRecord = {
      id,
      filename: file.name,
      mimetype: file.type,
      size: file.size,
      path: stored.path,
      uploadedAt: base.uploadedAt,
      ...normalizeMetadata(base),
    }

    if (optimizer && stored.localPath && IMAGE_MIMES.has(file.type) && file.type !== "image/svg+xml") {
      try {
        const result = await optimizer.processImage(stored.localPath, id)
        record.width = result.width
        record.height = result.height
        record.blurDataURL = result.blurDataURL
        record.variants = result.variants
      } catch {
        // Optimization failed; serve original.
      }
    }

    return record
  }

  async function getVariant(record: MediaRecord, width: number, format: VariantFormat): Promise<ImageVariant | null> {
    const existing = record.variants?.find((variant) => variant.width === width && variant.format === format)
    if (existing) return existing
    if (!optimizer || config.provider !== "local") return null
    const variant = await optimizer.getOrCreateVariant(record.path, record.id, { width, format })
    record.variants = [...(record.variants ?? []), variant].sort((a, b) => a.width - b.width)
    records.set(record.id, record)
    persistIndex()
    return variant
  }
}

function createLocalObjectProvider(baseDir: string): ObjectProvider {
  if (!existsSync(baseDir)) mkdirSync(baseDir, { recursive: true })

  return {
    async put(key: string, file: File) {
      const filePath = join(baseDir, key)
      const buffer = await file.arrayBuffer()
      await Bun.write(filePath, buffer)
      return { path: filePath, localPath: filePath }
    },

    async get(path: string) {
      if (!existsSync(path)) return null
      return Bun.file(path)
    },

    async delete(path: string) {
      try { unlinkSync(path) } catch {}
    },
  }
}

function createS3ObjectProvider(config: S3StorageConfig): ObjectProvider {
  const bucket = config.bucket ?? process.env.S3_BUCKET ?? process.env.AWS_BUCKET_NAME
  const accessKeyId = config.accessKeyId ?? process.env.S3_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = config.secretAccessKey ?? process.env.S3_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY
  const region = config.region ?? process.env.S3_REGION ?? process.env.AWS_REGION ?? "auto"
  const endpoint = config.endpoint ?? process.env.S3_ENDPOINT ?? defaultS3Endpoint(region)
  const fetcher = config.fetch ?? fetch

  if (!bucket) throw new Error("S3 storage requires a bucket")
  if (!accessKeyId || !secretAccessKey) throw new Error("S3 storage requires access key credentials")

  return {
    async put(key: string, file: File) {
      const objectKey = withPrefix(config.prefix, key)
      const buffer = await file.arrayBuffer()
      const payloadHash = sha256Hex(Buffer.from(buffer))
      const signed = createS3SignedRequest({
        method: "PUT",
        endpoint,
        bucket,
        region,
        key: objectKey,
        accessKeyId,
        secretAccessKey,
        payloadHash,
        headers: {
          "content-type": file.type || "application/octet-stream",
        },
      })
      const res = await fetcher(signed.url, { method: "PUT", headers: signed.headers, body: buffer })
      if (!res.ok) throw new Error(`S3 upload failed with status ${res.status}`)
      return { path: objectKey }
    },

    async get(path: string) {
      const signed = createS3SignedRequest({
        method: "GET",
        endpoint,
        bucket,
        region,
        key: path,
        accessKeyId,
        secretAccessKey,
        payloadHash: "UNSIGNED-PAYLOAD",
      })
      const res = await fetcher(signed.url, { method: "GET", headers: signed.headers })
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`S3 download failed with status ${res.status}`)
      return await res.blob()
    },

    async delete(path: string) {
      const signed = createS3SignedRequest({
        method: "DELETE",
        endpoint,
        bucket,
        region,
        key: path,
        accessKeyId,
        secretAccessKey,
        payloadHash: "UNSIGNED-PAYLOAD",
      })
      const res = await fetcher(signed.url, { method: "DELETE", headers: signed.headers })
      if (!res.ok && res.status !== 404) throw new Error(`S3 delete failed with status ${res.status}`)
    },
  }
}

export function createS3SignedRequest(input: S3SignedRequestInput): S3SignedRequest {
  const endpoint = input.endpoint.replace(/\/+$/, "")
  const method = input.method.toUpperCase()
  const date = input.date ?? new Date()
  const amzDate = toAmzDate(date)
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = input.payloadHash ?? "UNSIGNED-PAYLOAD"
  const url = new URL(endpoint)
  const canonicalUri = `/${encodePathSegment(input.bucket)}/${encodeKeyPath(input.key)}`

  const canonicalHeaderValues: Record<string, string> = {
    ...lowercaseHeaders(input.headers ?? {}),
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  }
  const signedHeaderNames = Object.keys(canonicalHeaderValues).sort()
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${normalizeHeaderValue(canonicalHeaderValues[name])}\n`)
    .join("")
  const signedHeaders = signedHeaderNames.join(";")
  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n")

  const scope = `${dateStamp}/${input.region}/s3/aws4_request`
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n")
  const signature = hmacHex(signingKey(input.secretAccessKey, dateStamp, input.region), stringToSign)

  const headers = { ...canonicalHeaderValues }
  delete headers.host
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return {
    url: `${endpoint}${canonicalUri}`,
    headers,
  }
}

function normalizeMetadata(input: Partial<MediaMetadataInput>): Partial<MediaMetadataInput> {
  return {
    ...(input.alt !== undefined && { alt: String(input.alt) }),
    ...(input.title !== undefined && { title: String(input.title) }),
    ...(input.caption !== undefined && { caption: String(input.caption) }),
    ...(typeof input.focalX === "number" && Number.isFinite(input.focalX) && { focalX: clamp01(input.focalX) }),
    ...(typeof input.focalY === "number" && Number.isFinite(input.focalY) && { focalY: clamp01(input.focalY) }),
    ...(Array.isArray(input.tags) && { tags: normalizeTags(input.tags) }),
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

const MAX_TAG_LENGTH = 25
const MAX_TAGS = 30

function normalizeTag(raw: unknown): string {
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/^#+\s*/, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_TAG_LENGTH)
    .replace(/-+$/g, "")
}

function normalizeTags(input: unknown[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input) {
    const tag = normalizeTag(raw)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
    if (out.length >= MAX_TAGS) break
  }
  return out
}

function loadIndex(indexPath: string): Map<string, MediaRecord> {
  if (!existsSync(indexPath)) return new Map()

  try {
    const parsed = JSON.parse(readFileSync(indexPath, "utf8")) as MediaRecord[]
    return new Map(parsed.map((record) => [record.id, record]))
  } catch {
    return new Map()
  }
}

function defaultS3Endpoint(region: string): string {
  if (region === "us-east-1") return "https://s3.amazonaws.com"
  return `https://s3.${region}.amazonaws.com`
}

function withPrefix(prefix: string | undefined, key: string): string {
  const normalizedPrefix = prefix?.replace(/^\/+|\/+$/g, "")
  return normalizedPrefix ? `${normalizedPrefix}/${key}` : key
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value)
}

function encodeKeyPath(key: string): string {
  return key.split("/").map(encodePathSegment).join("/")
}

function lowercaseHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    result[key.toLowerCase()] = value
  }
  return result
}

function normalizeHeaderValue(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "")
}

function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex")
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest()
}

function hmacHex(key: string | Buffer, data: string): string {
  return createHmac("sha256", key).update(data).digest("hex")
}

function signingKey(secretAccessKey: string, dateStamp: string, region: string): Buffer {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp)
  const regionKey = hmac(dateKey, region)
  const serviceKey = hmac(regionKey, "s3")
  return hmac(serviceKey, "aws4_request")
}
