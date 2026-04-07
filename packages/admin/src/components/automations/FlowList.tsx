import { useState, useEffect } from "react"
import type { Flow, FlowTrigger } from "./flow-types"

type Props = {
  apiBase?: string
}

function triggerBadgeLabel(trigger: FlowTrigger): string {
  switch (trigger.type) {
    case "content.created": return "content.created"
    case "content.updated": return "content.updated"
    case "content.published": return "content.published"
    case "content.deleted": return "content.deleted"
    case "webhook.received": return "webhook"
    case "schedule.cron": return `cron: ${trigger.cron}`
    default: return "unknown"
  }
}

export function FlowList({ apiBase = "" }: Props) {
  const [flows, setFlows] = useState<Flow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchFlows()
  }, [])

  const fetchFlows = async () => {
    try {
      const res = await fetch(`${apiBase}/api/_flows`)
      if (res.ok) {
        const data = await res.json()
        setFlows(data.data || [])
      }
    } catch {} finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await fetch(`${apiBase}/api/_flows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Untitled Flow",
          trigger: { type: "content.created" },
          steps: [],
          active: false,
        }),
      })
      if (res.ok) {
        const flow: Flow = await res.json()
        window.location.href = `/automations/${flow.id}`
      }
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (flow: Flow) => {
    await fetch(`${apiBase}/api/_flows/${flow.id}/toggle`, { method: "POST" })
    fetchFlows()
  }

  const handleDelete = async (flow: Flow) => {
    if (!confirm(`Delete flow "${flow.name}"?`)) return
    await fetch(`${apiBase}/api/_flows/${flow.id}`, { method: "DELETE" })
    fetchFlows()
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading automations...</p>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Flows</h2>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? "Creating…" : "+ New Flow"}
        </button>
      </div>

      {flows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          No flows yet. Create one to get started.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {flows.map((flow) => (
            <div key={flow.id} className="p-4 flex items-center justify-between">
              <div>
                <a
                  href={`/automations/${flow.id}`}
                  className="text-sm font-medium text-gray-900 hover:text-blue-600"
                >
                  {flow.name}
                </a>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {triggerBadgeLabel(flow.trigger)}
                  </span>
                  {flow.description && (
                    <span className="text-xs text-gray-400">{flow.description}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggle(flow)}
                  className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
                    flow.active
                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {flow.active ? "Active" : "Inactive"}
                </button>
                <a
                  href={`/automations/${flow.id}`}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Edit
                </a>
                <button
                  onClick={() => handleDelete(flow)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
