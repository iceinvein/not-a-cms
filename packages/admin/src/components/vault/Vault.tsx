import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { FileText, ImageIcon, RefreshCw, Trash2, Upload, Video, X } from "lucide-react"
import { EmptyState, ErrorState, LoadingState } from "../AdminState"
import { adminApiFetch } from "../../lib/api"
import {
  deleteMediaItem,
  listMediaItems,
  normalizeTagInput,
  replaceMediaFile,
  type AdminMediaItem,
  updateMediaItem,
  uploadMediaFile,
} from "../../lib/media"
import { clusterAssets, type Cluster } from "../../lib/media/cluster"
import { allTags, filterByTag } from "../../lib/media/tags"

type UsageReference = {
  collection: string
  documentId: string
  label: string
  field: string
}

type Usage = {
  count: number
  references: UsageReference[]
}

type VaultProps = {
  apiBase?: string
  initialItems?: AdminMediaItem[]
  initialCounts?: Record<string, number>
  initialSelected?: AdminMediaItem | null
  initialUsage?: Usage | null
}

type MetadataState = {
  alt: string
  title: string
  caption: string
  focalX: string
  focalY: string
  tags: string[]
}

function toMetadataState(item: AdminMediaItem | null): MetadataState {
  return {
    alt: item?.alt ?? "",
    title: item?.title ?? "",
    caption: item?.caption ?? "",
    focalX: String(item?.focalX ?? 0.5),
    focalY: String(item?.focalY ?? 0.5),
    tags: item?.tags ?? [],
  }
}

export function Vault({
  apiBase = "",
  initialItems = [],
  initialCounts = {},
  initialSelected = null,
  initialUsage = null,
}: VaultProps) {
  const [items, setItems] = useState<AdminMediaItem[]>(initialItems)
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts)
  const [loading, setLoading] = useState(initialItems.length === 0)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [usageLoading, setUsageLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(initialSelected?.id ?? initialItems[0]?.id ?? null)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [usage, setUsage] = useState<Usage | null>(initialUsage)
  const [metadata, setMetadata] = useState<MetadataState>(() => toMetadataState(initialSelected ?? initialItems[0] ?? null))
  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  const selectedItem = items.find((item) => item.id === selectedId) ?? initialSelected ?? null
  const tags = useMemo(() => allTags(items), [items])
  const clusters = useMemo(() => clusterAssets(filterByTag(items, activeTag), counts), [items, counts, activeTag])

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const [mediaItems, usageCounts] = await Promise.all([listMediaItems(apiBase), fetchUsageCounts(apiBase)])
      setItems(mediaItems)
      setCounts(usageCounts)
      setSelectedId((current) => current ?? mediaItems[0]?.id ?? null)
    } catch (err: any) {
      setError(err.message || "Failed to load media")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialItems.length > 0) return
    refresh()
  }, [apiBase])

  useEffect(() => {
    if (!selectedItem) return
    setMetadata(toMetadataState(selectedItem))
  }, [selectedItem?.id])

  useEffect(() => {
    if (!selectedItem) {
      setUsage(null)
      return
    }
    if (initialUsage && selectedItem.id === initialSelected?.id) {
      setUsage(initialUsage)
      return
    }

    let cancelled = false
    setUsage(null)
    setUsageLoading(true)
    fetchUsage(apiBase, selectedItem.id)
      .then((nextUsage) => {
        if (!cancelled) setUsage(nextUsage)
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message || "Failed to load media usage")
      })
      .finally(() => {
        if (!cancelled) setUsageLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [apiBase, selectedItem?.id])

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files?.length) return

    setUploading(true)
    setError(null)
    try {
      const uploaded: AdminMediaItem[] = []
      for (const file of Array.from(files)) {
        uploaded.push(await uploadMediaFile(apiBase, file))
      }
      setItems((current) => [...uploaded, ...current])
      setSelectedId(uploaded[0]?.id ?? selectedId)
      setCounts(await fetchUsageCounts(apiBase))
    } catch (err: any) {
      setError(err.message || "Failed to upload media")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSaveMetadata = async () => {
    if (!selectedItem) return
    setSaving(true)
    setError(null)
    try {
      const updated = await updateMediaItem(apiBase, selectedItem.id, {
        alt: metadata.alt,
        title: metadata.title,
        caption: metadata.caption,
        focalX: Number(metadata.focalX),
        focalY: Number(metadata.focalY),
        tags: metadata.tags,
      })
      const nextItems = items.map((item) => (item.id === updated.id ? updated : item))
      setItems(nextItems)
      if (activeTag && !nextItems.some((item) => (item.tags ?? []).includes(activeTag))) {
        setActiveTag(null)
      }
    } catch (err: any) {
      setError(err.message || "Failed to update media")
    } finally {
      setSaving(false)
    }
  }

  const handleReplace = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !selectedItem) return
    setReplacing(true)
    setError(null)
    try {
      const updated = await replaceMediaFile(apiBase, selectedItem.id, file)
      setItems((current) => current.map((item) => item.id === updated.id ? updated : item))
    } catch (err: any) {
      setError(err.message || "Failed to replace media file")
    } finally {
      setReplacing(false)
      if (replaceInputRef.current) replaceInputRef.current.value = ""
    }
  }

  const handleDelete = async () => {
    if (!selectedItem) return
    if ((usage?.count ?? counts[selectedItem.id] ?? 0) > 0 && !confirm("This asset is used in content. Delete it anyway?")) {
      return
    }
    setError(null)
    try {
      await deleteMediaItem(apiBase, selectedItem.id)
      setItems((current) => current.filter((item) => item.id !== selectedItem.id))
      setSelectedId(null)
      setUsage(null)
    } catch (err: any) {
      setError(err.message || "Failed to delete media")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-[#fafafa]">The Vault</h1>
          <p className="text-sm text-[#71717a]">{items.length} assets clustered by type and usage.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.1)] text-[#d4d4d8] hover:bg-[rgba(255,255,255,0.04)]"
            aria-label="Refresh media"
            title="Refresh media"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-[#c9956b] px-4 py-2 text-sm font-medium text-[#0a0a0c] transition-colors hover:bg-[#d4a57c] disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,application/pdf" onChange={handleUpload} className="hidden" />
      <input ref={replaceInputRef} type="file" accept="image/*,video/*,application/pdf" onChange={handleReplace} className="hidden" />

      {error && <ErrorState compact title="Vault action failed" description={error} />}

      {loading ? (
        <LoadingState compact title="Loading the vault" description="Fetching uploaded assets and usage counts." />
      ) : items.length === 0 ? (
        <EmptyState
          title="No media files yet"
          description="Upload images, videos, or documents to reuse them across your content."
          action={(
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#c9956b] px-4 py-2 text-sm font-medium text-[#0a0a0c] hover:bg-[#d4a57c]"
            >
              <Upload className="h-4 w-4" />
              Upload
            </button>
          )}
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            {tags.length > 0 && (
              <TagFilterBar tags={tags} activeTag={activeTag} onSelect={setActiveTag} />
            )}
            {clusters.map((cluster) => (
              <ClusterSection
                key={cluster.key}
                cluster={cluster}
                counts={counts}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ))}
          </div>

          <DetailPanel
            item={selectedItem}
            metadata={metadata}
            setMetadata={setMetadata}
            usage={usage}
            usageLoading={usageLoading}
            saving={saving}
            replacing={replacing}
            onSave={handleSaveMetadata}
            onReplace={() => replaceInputRef.current?.click()}
            onDelete={handleDelete}
          />
        </div>
      )}
    </div>
  )
}

function TagFilterBar({
  tags,
  activeTag,
  onSelect,
}: {
  tags: { tag: string; count: number }[]
  activeTag: string | null
  onSelect: (tag: string | null) => void
}) {
  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
      active
        ? "border-[#c9956b] bg-[rgba(201,149,107,0.12)] text-[#fafafa]"
        : "border-[rgba(255,255,255,0.1)] text-[#d4d4d8] hover:bg-[rgba(255,255,255,0.04)]"
    }`

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by tag">
      <button type="button" onClick={() => onSelect(null)} className={chip(activeTag === null)} aria-pressed={activeTag === null}>
        All
      </button>
      {tags.map(({ tag, count }) => (
        <button
          key={tag}
          type="button"
          onClick={() => onSelect(activeTag === tag ? null : tag)}
          className={chip(activeTag === tag)}
          aria-pressed={activeTag === tag}
        >
          #{tag}
          <span className="text-[#71717a]">{count}</span>
        </button>
      ))}
    </div>
  )
}

function ClusterSection({
  cluster,
  counts,
  selectedId,
  onSelect,
}: {
  cluster: Cluster
  counts: Record<string, number>
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-2">
        <div className="flex items-center gap-2">
          {clusterIcon(cluster.key)}
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#d4d4d8]">{cluster.label}</h2>
        </div>
        <span className="text-xs text-[#71717a]">{cluster.items.length} assets</span>
      </div>
      {cluster.items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[rgba(255,255,255,0.08)] px-4 py-6 text-sm text-[#71717a]">No assets in this cluster.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {cluster.items.map((item) => (
            <button
              key={`${cluster.key}-${item.id}`}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`group overflow-hidden rounded-lg border bg-[#18181b] text-left transition-all hover:border-[rgba(201,149,107,0.45)] ${selectedId === item.id ? "border-[#c9956b]" : "border-[rgba(255,255,255,0.06)]"}`}
            >
              <div className="relative aspect-square bg-[rgba(255,255,255,0.03)]">
                {item.mimetype.startsWith("image/") ? (
                  <img src={item.url} alt={item.alt || item.filename} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[#71717a]">
                    {item.mimetype.startsWith("video/") ? <Video className="h-9 w-9" /> : <FileText className="h-9 w-9" />}
                  </div>
                )}
                <span className="absolute right-2 top-2 rounded-full bg-[#0a0a0c]/85 px-2 py-1 text-[11px] font-medium text-[#fafafa]">
                  {counts[item.id] ?? 0} uses
                </span>
              </div>
              <div className="p-3">
                <p className="truncate text-xs font-medium text-[#fafafa]">{item.title || item.filename}</p>
                <p className="text-xs text-[#71717a]">{formatSize(item.size)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function DetailPanel({
  item,
  metadata,
  setMetadata,
  usage,
  usageLoading,
  saving,
  replacing,
  onSave,
  onReplace,
  onDelete,
}: {
  item: AdminMediaItem | null
  metadata: MetadataState
  setMetadata: React.Dispatch<React.SetStateAction<MetadataState>>
  usage: Usage | null
  usageLoading: boolean
  saving: boolean
  replacing: boolean
  onSave: () => void
  onReplace: () => void
  onDelete: () => void
}) {
  if (!item) {
    return (
      <aside className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#18181b] p-4">
        <EmptyState compact title="Select an asset" description="Inspect usage, edit metadata, replace, or delete an asset." />
      </aside>
    )
  }

  return (
    <aside className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#18181b] p-4">
      <div className="space-y-5">
        <div className="overflow-hidden rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]">
          {item.mimetype.startsWith("image/") ? (
            <img src={item.url} alt={item.alt || item.filename} className="max-h-72 w-full object-contain" />
          ) : (
            <div className="flex aspect-video items-center justify-center text-[#71717a]">
              {item.mimetype.startsWith("video/") ? <Video className="h-12 w-12" /> : <FileText className="h-12 w-12" />}
            </div>
          )}
        </div>

        <div>
          <p className="truncate text-sm font-medium text-[#fafafa]">{item.filename}</p>
          <p className="text-xs text-[#71717a]">
            {[formatSize(item.size), item.width && item.height ? `${item.width}x${item.height}` : null].filter(Boolean).join(" / ")}
          </p>
        </div>

        <section className="space-y-2 border-y border-[rgba(255,255,255,0.06)] py-4">
          <h2 className="text-sm font-semibold text-[#fafafa]">
            {usageLoading ? "Loading usage..." : usageLabel(usage?.count ?? 0)}
          </h2>
          {usage && usage.references.length > 0 ? (
            <ul className="space-y-2">
              {usage.references.map((reference) => (
                <li key={`${reference.collection}-${reference.documentId}-${reference.field}`}>
                  <a
                    href={`/content/${encodeURIComponent(reference.collection)}/${encodeURIComponent(reference.documentId)}`}
                    className="block rounded-lg border border-[rgba(255,255,255,0.06)] px-3 py-2 text-sm text-[#d4d4d8] hover:border-[rgba(201,149,107,0.35)] hover:bg-[rgba(255,255,255,0.03)]"
                  >
                    <span className="block truncate text-[#fafafa]">{reference.label}</span>
                    <span className="text-xs text-[#71717a]">{reference.collection} / {reference.field}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#71717a]">No content references this asset.</p>
          )}
        </section>

        <TagsField metadata={metadata} setMetadata={setMetadata} />

        <MetadataFields metadata={metadata} setMetadata={setMetadata} />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-lg bg-[#c9956b] px-4 py-2 text-sm font-medium text-[#0a0a0c] hover:bg-[#d4a57c] disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={onReplace}
            disabled={replacing}
            className="inline-flex items-center justify-center rounded-lg border border-[rgba(255,255,255,0.1)] px-4 py-2 text-sm font-medium text-[#fafafa] hover:bg-[rgba(255,255,255,0.04)] disabled:opacity-50"
          >
            {replacing ? "Replacing..." : "Replace"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-2 rounded-lg border border-[rgba(239,68,68,0.35)] px-4 py-2 text-sm font-medium text-[#f87171] hover:bg-[rgba(239,68,68,0.08)]"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>
    </aside>
  )
}

function TagsField({
  metadata,
  setMetadata,
}: {
  metadata: MetadataState
  setMetadata: React.Dispatch<React.SetStateAction<MetadataState>>
}) {
  const [draft, setDraft] = useState("")

  const addTag = () => {
    const tag = normalizeTagInput(draft)
    setDraft("")
    if (!tag) return
    setMetadata((current) =>
      current.tags.includes(tag) ? current : { ...current, tags: [...current.tags, tag] },
    )
  }

  const removeTag = (tag: string) => {
    setMetadata((current) => ({ ...current, tags: current.tags.filter((existing) => existing !== tag) }))
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-[#71717a]">Tags</h3>
      <div className="flex flex-wrap gap-1.5">
        {metadata.tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 text-xs text-[#d4d4d8]"
          >
            #{tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-[#71717a] hover:text-[#f87171]"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault()
            addTag()
          }
        }}
        onBlur={addTag}
        placeholder="Add a tag..."
        className="w-full rounded-lg border border-[rgba(255,255,255,0.1)] bg-transparent px-3 py-2 text-sm text-[#fafafa] outline-none placeholder:text-[#52525b] focus:border-[#c9956b]"
      />
    </div>
  )
}

function MetadataFields({
  metadata,
  setMetadata,
}: {
  metadata: MetadataState
  setMetadata: React.Dispatch<React.SetStateAction<MetadataState>>
}) {
  return (
    <div className="space-y-3">
      <label className="grid gap-1.5 text-xs font-medium uppercase tracking-[0.08em] text-[#71717a]">
        Title
        <input
          value={metadata.title}
          onChange={(event) => setMetadata((current) => ({ ...current, title: event.target.value }))}
          className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-transparent px-3 py-2 text-sm normal-case tracking-normal text-[#fafafa] outline-none placeholder:text-[#52525b] focus:border-[#c9956b]"
        />
      </label>
      <label className="grid gap-1.5 text-xs font-medium uppercase tracking-[0.08em] text-[#71717a]">
        Alt text
        <input
          value={metadata.alt}
          onChange={(event) => setMetadata((current) => ({ ...current, alt: event.target.value }))}
          className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-transparent px-3 py-2 text-sm normal-case tracking-normal text-[#fafafa] outline-none placeholder:text-[#52525b] focus:border-[#c9956b]"
        />
      </label>
      <label className="grid gap-1.5 text-xs font-medium uppercase tracking-[0.08em] text-[#71717a]">
        Caption
        <textarea
          value={metadata.caption}
          onChange={(event) => setMetadata((current) => ({ ...current, caption: event.target.value }))}
          rows={3}
          className="resize-none rounded-lg border border-[rgba(255,255,255,0.1)] bg-transparent px-3 py-2 text-sm normal-case tracking-normal text-[#fafafa] outline-none placeholder:text-[#52525b] focus:border-[#c9956b]"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1.5 text-xs font-medium uppercase tracking-[0.08em] text-[#71717a]">
          Focal X
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={metadata.focalX}
            onChange={(event) => setMetadata((current) => ({ ...current, focalX: event.target.value }))}
            className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-transparent px-3 py-2 text-sm normal-case tracking-normal text-[#fafafa] outline-none focus:border-[#c9956b]"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium uppercase tracking-[0.08em] text-[#71717a]">
          Focal Y
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={metadata.focalY}
            onChange={(event) => setMetadata((current) => ({ ...current, focalY: event.target.value }))}
            className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-transparent px-3 py-2 text-sm normal-case tracking-normal text-[#fafafa] outline-none focus:border-[#c9956b]"
          />
        </label>
      </div>
    </div>
  )
}

function clusterIcon(key: Cluster["key"]) {
  const className = "h-4 w-4 text-[#c9956b]"
  if (key === "images") return <ImageIcon className={className} />
  if (key === "video") return <Video className={className} />
  return <FileText className={className} />
}

async function fetchUsageCounts(apiBase: string): Promise<Record<string, number>> {
  const res = await adminApiFetch(apiBase, "/api/media/usage")
  if (!res.ok) throw new Error("Failed to load media usage counts")
  const body = await res.json() as { counts?: Record<string, number> }
  return body.counts ?? {}
}

async function fetchUsage(apiBase: string, id: string): Promise<Usage> {
  const res = await adminApiFetch(apiBase, `/api/media/${encodeURIComponent(id)}/usage`)
  if (!res.ok) throw new Error("Failed to load media usage")
  return await res.json() as Usage
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function usageLabel(count: number) {
  return `Used in ${count} ${count === 1 ? "place" : "places"}`
}
