import { useState, useEffect } from "react"
import type { FlowStep, FlowRun } from "./flow-types"
import { RunDetail } from "./RunDetail"

type Props = {
  flowId: string
  apiBase?: string
  steps: FlowStep[]
}

const PAGE_SIZE = 20

function statusBadge(status: string) {
  const base = "inline-block text-xs px-2 py-0.5 rounded-full font-medium"
  if (status === "completed") return `${base} bg-green-100 text-green-700`
  if (status === "failed") return `${base} bg-red-100 text-red-700`
  return `${base} bg-gray-100 text-gray-500`
}

function formatDuration(started: string, finished?: string): string {
  if (!finished) return "—"
  const ms = new Date(finished).getTime() - new Date(started).getTime()
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString()
}

export function RunList({ flowId, apiBase = "", steps }: Props) {
  const [runs, setRuns] = useState<FlowRun[]>([])
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`${apiBase}/api/_flows/${flowId}/runs?limit=${PAGE_SIZE}&offset=${offset}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json: { data: FlowRun[] }) => {
        const runs = json.data ?? []
        setRuns(runs)
        setHasMore(runs.length === PAGE_SIZE)
      })
      .catch(() => setRuns([]))
      .finally(() => setLoading(false))
  }, [flowId, offset, apiBase])

  if (selectedRunId) {
    return (
      <div className="flex flex-col gap-3">
        <button
          onClick={() => setSelectedRunId(null)}
          className="self-start text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          ← Back to runs
        </button>
        <RunDetail
          flowId={flowId}
          runId={selectedRunId}
          apiBase={apiBase}
          steps={steps}
        />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {loading ? (
        <p className="text-gray-400 text-sm text-center py-12">Loading runs…</p>
      ) : runs.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-12">
          No runs yet. Trigger the flow to see execution history.
        </p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Timestamp</th>
                <th className="text-left px-4 py-3">Trigger event</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {runs.map((run) => (
                <tr
                  key={run.id}
                  onClick={() => setSelectedRunId(run.id)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {formatTimestamp(run.started_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                    {run.trigger_event}
                  </td>
                  <td className="px-4 py-3">
                    <span className={statusBadge(run.status)}>{run.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {formatDuration(run.started_at, run.finished_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <button
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              className="text-sm text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <span className="text-xs text-gray-400">
              Showing {offset + 1}–{offset + runs.length}
            </span>
            <button
              disabled={!hasMore}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
              className="text-sm text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  )
}
