import { useEffect, useState } from "react"
import { adminApiFetch } from "../lib/api"

type Version = {
  id: string
  version_number: number
  action: "save" | "publish"
  created_at: string
  data: Record<string, unknown>
}

type VersionChange = {
  field: string
  before: unknown
  after: unknown
}

type Props = {
  collection: string
  documentId: string
  apiBase?: string
  onRestore: (data: Record<string, unknown>) => void
}

export function VersionHistory({ collection, documentId, apiBase = "", onRestore }: Props) {
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [changes, setChanges] = useState<Record<string, VersionChange[]>>({})
  const [restoring, setRestoring] = useState<string | null>(null)

  useEffect(() => {
    if (!documentId) return
    setLoading(true)
    adminApiFetch(apiBase, `/api/${collection}/${documentId}/versions`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((res) => setVersions(res.data || []))
      .catch(() => setVersions([]))
      .finally(() => setLoading(false))
  }, [collection, documentId, apiBase])

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })

  const toggleExpanded = async (versionId: string) => {
    const next = expanded === versionId ? null : versionId
    setExpanded(next)
    if (!next || changes[versionId]) return

    const res = await adminApiFetch(
      apiBase,
      `/api/${collection}/${documentId}/versions/${versionId}/compare`,
    )
    if (!res.ok) return
    const body = await res.json()
    setChanges((current) => ({ ...current, [versionId]: body.changes ?? [] }))
  }

  const restoreVersion = async (version: Version) => {
    if (!confirm("Restore this version? Current unsaved changes will be lost.")) return

    setRestoring(version.id)
    try {
      const res = await adminApiFetch(
        apiBase,
        `/api/${collection}/${documentId}/versions/${version.id}/restore`,
        {
          method: "POST",
        },
      )
      if (!res.ok) throw new Error("Failed to restore version")
      const restored = await res.json()
      onRestore(restored)
    } finally {
      setRestoring(null)
    }
  }

  if (loading) {
    return <p className="text-xs text-[#838389] py-2">Loading history...</p>
  }

  if (versions.length === 0) {
    return <p className="text-xs text-[#838389] py-2">No version history yet</p>
  }

  return (
    <div className="space-y-1">
      {versions.map((v) => (
        <div key={v.id} className="border border-[rgba(255,255,255,0.06)] rounded-lg">
          <button
            type="button"
            onClick={() => {
              void toggleExpanded(v.id)
            }}
            className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[rgba(255,255,255,0.03)] rounded-lg transition-colors"
          >
            <div>
              <span className="text-xs font-medium text-[#a1a1aa]">v{v.version_number}</span>
              <span
                className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                  v.action === "publish"
                    ? "bg-[rgba(34,197,94,0.1)] text-[#22c55e]"
                    : "bg-[rgba(255,255,255,0.05)] text-[#909099]"
                }`}
              >
                {v.action}
              </span>
            </div>
            <span className="text-xs text-[#838389]">{formatDate(v.created_at)}</span>
          </button>
          {expanded === v.id && (
            <div className="px-3 pb-2 border-t border-[rgba(255,255,255,0.06)] space-y-2">
              <div className="pt-2 space-y-1">
                {(changes[v.id] ?? []).length === 0 ? (
                  <p className="text-xs text-[#838389]">
                    No field changes from the current version.
                  </p>
                ) : (
                  changes[v.id].map((change) => (
                    <div
                      key={change.field}
                      className="rounded-md bg-[rgba(255,255,255,0.03)] px-2 py-1"
                    >
                      <p className="text-xs font-medium text-[#a1a1aa]">{change.field}</p>
                      <p className="text-[11px] text-[#909099] line-through">
                        {formatValue(change.before)}
                      </p>
                      <p className="text-[11px] text-[#fafafa]">{formatValue(change.after)}</p>
                    </div>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  void restoreVersion(v)
                }}
                disabled={restoring === v.id}
                className="mt-2 w-full py-1.5 text-xs font-medium text-[#a1a1aa] border border-[rgba(255,255,255,0.06)] rounded-lg hover:bg-[rgba(255,255,255,0.03)] transition-colors"
              >
                {restoring === v.id ? "Restoring..." : "Restore this version"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function formatValue(value: unknown): string {
  if (value === undefined) return "not set"
  if (value === null) return "null"
  if (typeof value === "string") return value || "empty"
  return JSON.stringify(value)
}
