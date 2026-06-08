import { useEffect, useState } from "react"
import { getAdminApiBase } from "../../../lib/api"
import { type AdminMediaItem, listMediaItems, uploadMediaFile } from "../../../lib/media"

type Props = {
  /** Current image URL (for the thumbnail preview), if any. */
  value?: string
  onSelect: (item: AdminMediaItem) => void
  onClear?: () => void
  chooseLabel?: string
}

/**
 * Shared Vault picker used by the inline image and hero background-image blocks:
 * a thumbnail preview, a choose/replace control, inline upload, optional clear, and
 * a grid of existing images. Fetches from the configured API base (not the admin
 * origin) so it works across origins.
 */
export function MediaPicker({ value, onSelect, onClear, chooseLabel = "Choose image" }: Props) {
  const apiBase = getAdminApiBase()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AdminMediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    listMediaItems(apiBase)
      .then((all) => setItems(all.filter((item) => item.mimetype.startsWith("image/"))))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [open, apiBase])

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const item = await uploadMediaFile(apiBase, file)
      setItems((prev) => [item, ...prev])
      onSelect(item)
    } catch {
      // surfaced by the Vault page; keep the block usable
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="cn-media-pick">
      {value && <img className="cn-media-pick-thumb" src={value} alt="" />}
      <div className="cn-media-pick-actions">
        <button
          type="button"
          className={`cn-block-action${value ? "" : " cn-block-cta"}`}
          onClick={() => setOpen((current) => !current)}
        >
          {value ? "Replace" : chooseLabel}
        </button>
        <label className="cn-block-action cn-media-pick-upload">
          {uploading ? "Uploading…" : "Upload"}
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) handleUpload(file)
              event.target.value = ""
            }}
          />
        </label>
        {value && onClear && (
          <button type="button" className="cn-block-action" onClick={onClear}>
            Remove
          </button>
        )}
      </div>
      {open && (
        <div className="cn-gallery-picker">
          {loading ? (
            <span className="cn-gallery-empty">Loading media...</span>
          ) : items.length === 0 ? (
            <span className="cn-gallery-empty">No images uploaded yet.</span>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="cn-gallery-choice"
                onClick={() => {
                  onSelect(item)
                  setOpen(false)
                }}
              >
                <img src={item.url} alt="" />
                <span>{item.filename}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
