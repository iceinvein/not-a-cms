import { useState, useEffect } from "react"

type Version = {
  id: string
  version_number: number
  action: "save" | "publish"
  created_at: string
  data: Record<string, unknown>
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

  useEffect(() => {
    if (!documentId) return
    setLoading(true)
    fetch(`${apiBase}/api/${collection}/${documentId}/versions`)
      .then((res) => res.ok ? res.json() : { data: [] })
      .then((res) => setVersions(res.data || []))
      .catch(() => setVersions([]))
      .finally(() => setLoading(false))
  }, [collection, documentId, apiBase])

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    })

  if (loading) {
    return <p className="text-xs text-gray-400 py-2">Loading history...</p>
  }

  if (versions.length === 0) {
    return <p className="text-xs text-gray-400 py-2">No version history yet</p>
  }

  return (
    <div className="space-y-1">
      {versions.map((v) => (
        <div key={v.id} className="border border-gray-100 rounded-lg">
          <button
            onClick={() => setExpanded(expanded === v.id ? null : v.id)}
            className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 rounded-lg transition-colors"
          >
            <div>
              <span className="text-xs font-medium text-gray-700">v{v.version_number}</span>
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                v.action === "publish" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
              }`}>
                {v.action}
              </span>
            </div>
            <span className="text-xs text-gray-400">{formatDate(v.created_at)}</span>
          </button>
          {expanded === v.id && (
            <div className="px-3 pb-2 border-t border-gray-100">
              <button
                onClick={() => {
                  if (confirm("Restore this version? Current unsaved changes will be lost.")) {
                    onRestore(v.data)
                  }
                }}
                className="mt-2 w-full py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Restore this version
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
