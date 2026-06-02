import { useState } from "react"
import { Trash2, X } from "lucide-react"
import { deleteMediaTag, renameMediaTag, setMediaTagColor, type MediaTag } from "../../lib/media"

const PALETTE = ["#c9956b", "#6b9bc9", "#8bbf7a", "#c97a8b", "#b08bc9", "#c9b06b", "#6bc9b0", "#9b9b6b"]

export function TagManager({
  apiBase,
  tags,
  onClose,
  onChanged,
}: {
  apiBase: string
  tags: MediaTag[]
  onClose: () => void
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wrap = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onChanged()
    } catch (err: any) {
      setError(err.message || "Failed to update tag")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0c]/75 p-4" role="dialog" aria-modal="true" aria-label="Manage tags">
      <div className="w-full max-w-2xl rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#18181b] p-5 shadow-2xl shadow-black/30">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl text-[#fafafa]">Manage tags</h2>
            <p className="text-sm text-[#71717a]">Rename, recolor, or remove tags from every asset.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-[#71717a] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#fafafa]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && <p className="mb-3 rounded-lg border border-[rgba(239,68,68,0.35)] px-3 py-2 text-sm text-[#f87171]">{error}</p>}

        {tags.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[rgba(255,255,255,0.08)] px-4 py-6 text-sm text-[#71717a]">No tags yet.</p>
        ) : (
          <ul className="max-h-[70vh] space-y-2 overflow-auto pr-1">
            {tags.map((tag) => (
              <li key={tag.name} className="grid gap-3 rounded-lg border border-[rgba(255,255,255,0.06)] px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                <label className="flex min-w-0 items-center gap-3">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                  <input
                    defaultValue={tag.name}
                    disabled={busy}
                    onBlur={(event) => {
                      const value = event.target.value.trim()
                      if (value && value !== tag.name) void wrap(() => renameMediaTag(apiBase, tag.name, value))
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm text-[#fafafa] outline-none focus:border-[#c9956b]"
                    aria-label={`Rename ${tag.name}`}
                  />
                </label>

                <span className="text-xs text-[#71717a]">{tag.count} assets</span>

                <div className="flex items-center gap-2">
                  <div className="flex flex-wrap gap-1" aria-label={`Color options for ${tag.name}`}>
                    {PALETTE.map((color) => (
                      <button
                        key={color}
                        type="button"
                        disabled={busy}
                        aria-label={`Set ${tag.name} color ${color}`}
                        onClick={() => void wrap(() => setMediaTagColor(apiBase, tag.name, color))}
                        className={`h-5 w-5 rounded-full border transition-transform hover:scale-110 disabled:opacity-50 ${tag.color === color ? "border-[#fafafa]" : "border-[rgba(255,255,255,0.25)]"}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`Delete ${tag.name}`}
                    onClick={() => {
                      if (confirm(`Delete "${tag.name}"? It is used in ${tag.count} asset(s).`)) void wrap(() => deleteMediaTag(apiBase, tag.name))
                    }}
                    className="rounded-lg p-1 text-[#f87171] hover:bg-[rgba(239,68,68,0.08)] hover:text-[#fca5a5] disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
