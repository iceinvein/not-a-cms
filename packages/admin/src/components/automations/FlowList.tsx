import { useState, useEffect } from "react"
import type { Flow, FlowTrigger } from "./flow-types"
import { EmptyState, ErrorState, LoadingState } from "../AdminState"
import { adminApiFetch, messageForAdminResponse } from "../../lib/api"

type Props = {
  apiBase?: string
}

const triggerLabels: Record<string, string> = {
  "content.created": "Content Created",
  "content.updated": "Content Updated",
  "content.published": "Content Published",
  "content.deleted": "Content Deleted",
  "webhook.received": "Webhook",
  "schedule.cron": "Scheduled",
}

function triggerBadgeLabel(trigger: FlowTrigger): string {
  return triggerLabels[trigger.type] ?? trigger.type
}

export function FlowList({ apiBase = "" }: Props) {
  const [flows, setFlows] = useState<Flow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchFlows()
  }, [])

  const fetchFlows = async () => {
    setError("")
    try {
      const res = await adminApiFetch(apiBase, "/api/_flows")
      if (res.ok) {
        const data = await res.json()
        setFlows(data.data || [])
      } else {
        setError(messageForAdminResponse(res, "Could not load automations."))
      }
    } catch {
      setError("Could not reach the server.")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    setCreating(true)
    setError("")
    try {
      const res = await adminApiFetch(apiBase, "/api/_flows", {
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
      } else {
        setError("Failed to create flow. The server returned an error.")
      }
    } catch {
      setError("Could not reach the server. Make sure the API is running.")
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (flow: Flow) => {
    await adminApiFetch(apiBase, `/api/_flows/${flow.id}/toggle`, { method: "POST" })
    fetchFlows()
  }

  const handleDelete = async (flow: Flow) => {
    if (!confirm(`Delete flow "${flow.name}"?`)) return
    await adminApiFetch(apiBase, `/api/_flows/${flow.id}`, { method: "DELETE" })
    fetchFlows()
  }

  if (loading) return <LoadingState title="Loading automations" description="Fetching flow definitions." />

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button
          onClick={handleCreate}
          disabled={creating}
          className="px-4 py-2 bg-[#c9956b] text-[#0a0a0c] rounded-lg text-sm font-medium hover:bg-[#d4a57c] disabled:opacity-50 transition-colors"
        >
          {creating ? "Creating..." : "+ New Flow"}
        </button>
      </div>

      {error && (
        <ErrorState title="Automation action failed" description={error} action={<button onClick={fetchFlows} className="px-3 py-1.5 text-sm font-medium text-[#fafafa] bg-[rgba(255,255,255,0.08)] rounded-md hover:bg-[rgba(255,255,255,0.12)] transition-colors">Try again</button>} />
      )}

      {flows.length === 0 ? (
        <EmptyState
          title="No automation flows yet"
          description="Flows run when content events happen. Send notifications, transform data, or trigger external services."
        />
      ) : (
        <div className="bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] divide-y divide-[rgba(255,255,255,0.06)]">
          {flows.map((flow) => (
            <div key={flow.id} className="p-4 flex items-center justify-between">
              <div>
                <a
                  href={`/automations/${flow.id}`}
                  className="text-sm font-medium text-[#fafafa] hover:text-[#c9956b] transition-colors"
                >
                  {flow.name}
                </a>
                <div className="flex gap-2 mt-1 items-center flex-wrap">
                  <span className="text-xs bg-[rgba(255,255,255,0.05)] text-[#71717a] px-2 py-0.5 rounded-full">
                    {triggerBadgeLabel(flow.trigger)}
                  </span>
                  <span className="text-xs bg-[rgba(255,255,255,0.05)] text-[#71717a] px-2 py-0.5 rounded-full">
                    {flow.steps?.length ?? 0} steps
                  </span>
                  {flow.description && (
                    <span className="text-xs text-[#52525b]">{flow.description}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#52525b]">{new Date(flow.updated_at).toLocaleDateString()}</span>
                <button
                  onClick={() => handleToggle(flow)}
                  className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
                    flow.active
                      ? "bg-[rgba(34,197,94,0.1)] text-[#22c55e]"
                      : "bg-[rgba(255,255,255,0.05)] text-[#71717a]"
                  }`}
                >
                  {flow.active ? "Active" : "Inactive"}
                </button>
                <button
                  onClick={() => handleDelete(flow)}
                  className="text-xs text-[#52525b] hover:text-[#ef4444] transition-colors"
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
