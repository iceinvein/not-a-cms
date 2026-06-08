import { type ChangeEvent, useEffect, useRef, useState } from "react"
import {
  type AdminMediaItem,
  deleteMediaItem,
  listMediaItems,
  replaceMediaFile,
  updateMediaItem,
  uploadMediaFile,
} from "../lib/media"
import { EmptyState, ErrorState, LoadingState } from "./AdminState"

export function MediaLibrary({ apiBase = "" }: { apiBase?: string }) {
  const [items, setItems] = useState<AdminMediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [metadata, setMetadata] = useState({
    alt: "",
    title: "",
    caption: "",
    focalX: "0.5",
    focalY: "0.5",
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const selectedItem = items.find((item) => item.id === selectedId) ?? null

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await listMediaItems(apiBase))
    } catch (err: any) {
      setError(err.message || "Failed to load media")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [apiBase])

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return

    setUploading(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        const item = await uploadMediaFile(apiBase, file)
        setItems((prev) => [item, ...prev])
        setSelectedId(item.id)
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload media")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleDelete = async (item: AdminMediaItem) => {
    setError(null)
    try {
      await deleteMediaItem(apiBase, item.id)
      setItems((prev) => prev.filter((existing) => existing.id !== item.id))
      if (selectedId === item.id) setSelectedId(null)
    } catch (err: any) {
      setError(err.message || "Failed to delete media")
    }
  }

  useEffect(() => {
    if (!selectedItem) return
    setMetadata({
      alt: selectedItem.alt ?? "",
      title: selectedItem.title ?? "",
      caption: selectedItem.caption ?? "",
      focalX: String(selectedItem.focalX ?? 0.5),
      focalY: String(selectedItem.focalY ?? 0.5),
    })
  }, [selectedItem?.id])

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
      })
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
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
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err: any) {
      setError(err.message || "Failed to replace media file")
    } finally {
      setReplacing(false)
      if (replaceInputRef.current) replaceInputRef.current.value = ""
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#c9956b] text-[#0a0a0c] rounded-lg text-sm font-medium hover:bg-[#d4a57c] disabled:opacity-50 transition-colors"
        >
          {uploading ? "Uploading..." : "+ Upload Files"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,application/pdf"
          onChange={handleUpload}
          className="hidden"
        />
        <span className="text-sm text-[#52525b]">{items.length} files</span>
      </div>
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*,video/*,application/pdf"
        onChange={handleReplace}
        className="hidden"
      />

      {error && <ErrorState compact title="Media action failed" description={error} />}

      {loading ? (
        <LoadingState compact title="Loading media" description="Fetching uploaded files." />
      ) : items.length === 0 ? (
        <EmptyState
          title="No media files yet"
          description="Upload images, videos, or documents to reuse them across your content."
          action={
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#c9956b] text-[#0a0a0c] rounded-lg text-sm font-medium hover:bg-[#d4a57c] transition-colors"
            >
              Upload files
            </button>
          }
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`bg-[#18181b] rounded-xl border overflow-hidden text-left hover:border-[rgba(201,149,107,0.2)] transition-all group ${selectedId === item.id ? "border-[#c9956b]" : "border-[rgba(255,255,255,0.06)]"}`}
              >
                <div className="aspect-square bg-[rgba(255,255,255,0.03)] flex items-center justify-center overflow-hidden">
                  {item.mimetype.startsWith("image/") ? (
                    <img
                      src={item.url}
                      alt={item.alt || item.filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl opacity-40">File</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs font-medium text-[#fafafa] truncate">
                    {item.title || item.filename}
                  </p>
                  <p className="text-xs text-[#52525b]">{formatSize(item.size)}</p>
                </div>
              </button>
            ))}
          </div>

          <aside className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#18181b] p-4">
            {!selectedItem ? (
              <EmptyState
                compact
                title="Select a media item"
                description="Edit metadata, focal point, or replace the selected file."
              />
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-[#fafafa] truncate">
                    {selectedItem.filename}
                  </p>
                  <p className="text-xs text-[#71717a]">
                    {[
                      formatSize(selectedItem.size),
                      selectedItem.width && selectedItem.height
                        ? `${selectedItem.width}x${selectedItem.height}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" / ")}
                  </p>
                </div>

                <label className="grid gap-1.5 text-xs font-medium uppercase tracking-[0.08em] text-[#71717a]">
                  Title
                  <input
                    value={metadata.title}
                    onChange={(event) =>
                      setMetadata((current) => ({ ...current, title: event.target.value }))
                    }
                    className="px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm normal-case tracking-normal bg-transparent text-[#fafafa] placeholder:text-[#52525b] focus:border-[#c9956b] focus:outline-none"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-medium uppercase tracking-[0.08em] text-[#71717a]">
                  Alt text
                  <input
                    value={metadata.alt}
                    onChange={(event) =>
                      setMetadata((current) => ({ ...current, alt: event.target.value }))
                    }
                    className="px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm normal-case tracking-normal bg-transparent text-[#fafafa] placeholder:text-[#52525b] focus:border-[#c9956b] focus:outline-none"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-medium uppercase tracking-[0.08em] text-[#71717a]">
                  Caption
                  <textarea
                    value={metadata.caption}
                    onChange={(event) =>
                      setMetadata((current) => ({ ...current, caption: event.target.value }))
                    }
                    rows={3}
                    className="resize-none px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm normal-case tracking-normal bg-transparent text-[#fafafa] placeholder:text-[#52525b] focus:border-[#c9956b] focus:outline-none"
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
                      onChange={(event) =>
                        setMetadata((current) => ({ ...current, focalX: event.target.value }))
                      }
                      className="px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm normal-case tracking-normal bg-transparent text-[#fafafa] focus:border-[#c9956b] focus:outline-none"
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
                      onChange={(event) =>
                        setMetadata((current) => ({ ...current, focalY: event.target.value }))
                      }
                      className="px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm normal-case tracking-normal bg-transparent text-[#fafafa] focus:border-[#c9956b] focus:outline-none"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSaveMetadata}
                    disabled={saving}
                    className="inline-flex items-center justify-center px-4 py-2 bg-[#c9956b] text-[#0a0a0c] rounded-lg text-sm font-medium hover:bg-[#d4a57c] disabled:opacity-50 transition-colors"
                  >
                    {saving ? "Saving..." : "Save Metadata"}
                  </button>
                  <button
                    type="button"
                    onClick={() => replaceInputRef.current?.click()}
                    disabled={replacing}
                    className="inline-flex items-center justify-center px-4 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm font-medium text-[#fafafa] hover:bg-[rgba(255,255,255,0.04)] disabled:opacity-50"
                  >
                    {replacing ? "Replacing..." : "Replace File"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedItem)}
                    className="inline-flex items-center justify-center px-4 py-2 border border-[rgba(239,68,68,0.35)] rounded-lg text-sm font-medium text-[#f87171] hover:bg-[rgba(239,68,68,0.08)]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
