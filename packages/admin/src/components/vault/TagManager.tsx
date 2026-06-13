import { Trash2, X } from "lucide-react"
import { useState } from "react"
import {
  deleteMediaTag,
  type MediaTag,
  mergeMediaTag,
  renameMediaTag,
  setMediaTagColor,
  setMediaTagDescription,
  setMediaTagGroup,
} from "../../lib/media"

const PALETTE = [
  "#c6ff3d",
  "#6b9bc9",
  "#8bbf7a",
  "#c97a8b",
  "#b08bc9",
  "#c9b06b",
  "#6bc9b0",
  "#9b9b6b",
]
const UNGROUPED = "Ungrouped"

function groupTags(tags: MediaTag[]): { group: string; tags: MediaTag[] }[] {
  const byGroup = new Map<string, MediaTag[]>()
  for (const tag of tags) {
    const key = tag.group?.trim() || UNGROUPED
    const list = byGroup.get(key) ?? []
    list.push(tag)
    byGroup.set(key, list)
  }
  return [...byGroup.entries()]
    .sort((a, b) => (a[0] === UNGROUPED ? 1 : b[0] === UNGROUPED ? -1 : a[0].localeCompare(b[0])))
    .map(([group, list]) => ({ group, tags: list.sort((a, b) => a.name.localeCompare(b.name)) }))
}

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

  const groups = groupTags(tags)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0c]/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Manage tags"
    >
      <div className="w-full max-w-2xl rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#18181b] p-5 shadow-2xl shadow-black/30">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl text-[#fafafa]">Manage tags</h2>
            <p className="text-sm text-[#71717a]">
              Rename, recolor, describe, group, merge, or remove tags.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-[#71717a] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#fafafa]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-lg border border-[rgba(239,68,68,0.35)] px-3 py-2 text-sm text-[#f87171]">
            {error}
          </p>
        )}

        {tags.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[rgba(255,255,255,0.08)] px-4 py-6 text-sm text-[#71717a]">
            No tags yet.
          </p>
        ) : (
          <div className="max-h-[70vh] space-y-4 overflow-auto pr-1">
            {groups.map(({ group, tags: groupTagList }) => (
              <section key={group} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#71717a]">
                  {group}
                </h3>
                <ul className="space-y-2">
                  {groupTagList.map((tag) => (
                    <li
                      key={tag.name}
                      className="space-y-2 rounded-lg border border-[rgba(255,255,255,0.06)] px-3 py-3"
                    >
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        <label className="flex min-w-0 items-center gap-3">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          <input
                            defaultValue={tag.name}
                            disabled={busy}
                            onBlur={(event) => {
                              const value = event.target.value.trim()
                              if (value && value !== tag.name)
                                void wrap(() => renameMediaTag(apiBase, tag.name, value))
                            }}
                            className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm text-[#fafafa] outline-none focus:border-[#c6ff3d]"
                            aria-label={`Rename ${tag.name}`}
                          />
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#71717a]">{tag.count} assets</span>
                          <div
                            className="flex flex-wrap gap-1"
                            role="toolbar"
                            aria-label={`Color options for ${tag.name}`}
                          >
                            {PALETTE.map((color) => (
                              <button
                                key={color}
                                type="button"
                                disabled={busy}
                                aria-label={`Set ${tag.name} color ${color}`}
                                onClick={() =>
                                  void wrap(() => setMediaTagColor(apiBase, tag.name, color))
                                }
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
                              if (
                                confirm(
                                  `Delete "${tag.name}"? It is used in ${tag.count} asset(s).`,
                                )
                              )
                                void wrap(() => deleteMediaTag(apiBase, tag.name))
                            }}
                            className="rounded-lg p-1 text-[#f87171] hover:bg-[rgba(239,68,68,0.08)] hover:text-[#fca5a5] disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <input
                          defaultValue={tag.description ?? ""}
                          disabled={busy}
                          placeholder="Description"
                          onBlur={(event) => {
                            const value = event.target.value.trim()
                            if (value !== (tag.description ?? ""))
                              void wrap(() =>
                                setMediaTagDescription(apiBase, tag.name, value || null),
                              )
                          }}
                          className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-transparent px-2 py-1 text-sm text-[#d4d4d8] outline-none placeholder:text-[#52525b] focus:border-[#c6ff3d]"
                          aria-label={`Description for ${tag.name}`}
                        />
                        <input
                          defaultValue={tag.group ?? ""}
                          disabled={busy}
                          placeholder="Group"
                          onBlur={(event) => {
                            const value = event.target.value.trim()
                            if (value !== (tag.group ?? ""))
                              void wrap(() => setMediaTagGroup(apiBase, tag.name, value || null))
                          }}
                          className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-transparent px-2 py-1 text-sm text-[#d4d4d8] outline-none placeholder:text-[#52525b] focus:border-[#c6ff3d]"
                          aria-label={`Group for ${tag.name}`}
                        />
                        <select
                          value="__placeholder"
                          disabled={busy || tags.length < 2}
                          onChange={(event) => {
                            const target = event.target.value
                            event.currentTarget.value = "__placeholder"
                            if (
                              target !== "__placeholder" &&
                              confirm(
                                `Merge "${tag.name}" into "${target}"? "${tag.name}" will be removed.`,
                              )
                            ) {
                              void wrap(() => mergeMediaTag(apiBase, tag.name, target))
                            }
                          }}
                          className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#18181b] px-2 py-1 text-sm text-[#d4d4d8] outline-none focus:border-[#c6ff3d]"
                          aria-label={`Merge ${tag.name} into another tag`}
                        >
                          <option value="__placeholder" disabled>
                            Merge into...
                          </option>
                          {tags
                            .filter((other) => other.name !== tag.name)
                            .map((other) => (
                              <option key={other.name} value={other.name}>
                                {other.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
