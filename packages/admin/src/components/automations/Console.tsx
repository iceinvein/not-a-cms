import { useEffect, useRef, useState } from "react"
import { adminApiFetch, joinAdminApiUrl, messageForAdminResponse } from "../../lib/api"
import { applyRunCompleted, applyRunStep, upsertRun } from "../../lib/automations/run-stream"
import { EmptyState, ErrorState, LoadingState } from "../AdminState"
import type { FlowRun, FlowRunDetail, FlowRunStep } from "./flow-types"
import { formatMs, RunInspector, statusDot } from "./RunInspector"

type Props = {
  apiBase?: string
  flowId?: string
  initialRuns?: FlowRun[]
  initialSelected?: FlowRunDetail
  initialSelectedRunId?: string
}

function runDuration(run: FlowRun): string {
  if (!run.finished_at) return "running"
  return formatMs(
    Math.max(0, new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()),
  )
}

export function Console({
  apiBase = "",
  flowId,
  initialRuns,
  initialSelected,
  initialSelectedRunId,
}: Props) {
  const [runs, setRuns] = useState<FlowRun[]>(initialRuns ?? [])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    initialSelected?.id ?? initialSelectedRunId ?? initialRuns?.[0]?.id ?? null,
  )
  const [selectedRun, setSelectedRun] = useState<FlowRunDetail | null>(initialSelected ?? null)
  const [loading, setLoading] = useState(!initialRuns)
  const [error, setError] = useState("")
  const selectedRunRef = useRef<FlowRunDetail | null>(initialSelected ?? null)
  useEffect(() => {
    selectedRunRef.current = selectedRun
  }, [selectedRun])

  const fetchRuns = async () => {
    setError("")
    try {
      const res = await adminApiFetch(apiBase, "/api/_flows/runs?limit=50")
      if (!res.ok) {
        setError(messageForAdminResponse(res, "Could not load automation runs."))
        return
      }
      const data = await res.json()
      const nextRuns = data.data || []
      setRuns(nextRuns)
      setSelectedRunId((current) => current ?? nextRuns[0]?.id ?? null)
    } catch {
      setError("Could not reach the server.")
    } finally {
      setLoading(false)
    }
  }

  const fetchSelected = async (run: FlowRun) => {
    try {
      const res = await adminApiFetch(apiBase, `/api/_flows/${run.flow_id}/runs/${run.id}`)
      if (res.ok) setSelectedRun(await res.json())
    } catch {}
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-scoped fetch; fetchRuns/initialRuns are non-memoized and would re-run every render, apiBase scopes the (re)fetch intentionally.
  useEffect(() => {
    if (!initialRuns) fetchRuns()
  }, [apiBase])

  // biome-ignore lint/correctness/useExhaustiveDependencies: fires on selection/runs change; reading selectedRun is a guard, adding it (or non-memoized fetchSelected) would re-fire after each fetch and loop.
  useEffect(() => {
    const run = runs.find((item) => item.id === selectedRunId)
    if (!run) return
    if (selectedRun?.id !== run.id || !selectedRun.steps) fetchSelected(run)
  }, [selectedRunId, runs, apiBase])

  // biome-ignore lint/correctness/useExhaustiveDependencies: subscription scoped to apiBase/flowId; non-memoized fetchSelected would tear down and recreate the EventSource every render.
  useEffect(() => {
    const streamPath = `/api/_flows/runs/stream${flowId ? `?flowId=${encodeURIComponent(flowId)}` : ""}`
    let pollId: ReturnType<typeof setInterval> | null = null
    const startPolling = () => {
      if (pollId) return
      pollId = setInterval(() => {
        const current = selectedRunRef.current
        if (current && current.status === "running") fetchSelected(current)
      }, 2000)
    }

    let source: EventSource | null = null
    try {
      source = new EventSource(joinAdminApiUrl(apiBase, streamPath), { withCredentials: true })
    } catch {
      // EventSource unavailable (or constructor threw): degrade to polling.
      startPolling()
      return () => {
        if (pollId) clearInterval(pollId)
      }
    }

    const parseData = (event: Event): any | null => {
      try {
        return JSON.parse((event as MessageEvent).data)
      } catch {
        // Ignore a malformed frame rather than throwing inside the listener.
        return null
      }
    }

    source.addEventListener("run.started", (event) => {
      const data = parseData(event)
      if (!data) return
      setRuns((current) => upsertRun(current, data.run as FlowRun))
    })
    source.addEventListener("run.step", (event) => {
      const data = parseData(event) as { runId: string; step: FlowRunStep } | null
      if (!data) return
      setSelectedRun((current) => applyRunStep(current, data.runId, data.step))
    })
    source.addEventListener("run.completed", (event) => {
      const data = parseData(event)
      if (!data) return
      const run = data.run as FlowRun
      setRuns((current) => upsertRun(current, run))
      setSelectedRun((current) => applyRunCompleted(current, run))
    })
    source.onerror = () => {
      // EventSource auto-reconnects while CONNECTING. Only fall back to polling
      // once it has given up (CLOSED).
      if (source && source.readyState === EventSource.CLOSED) {
        source.close()
        startPolling()
      }
    }

    return () => {
      source?.close()
      if (pollId) clearInterval(pollId)
    }
  }, [apiBase, flowId])

  if (loading)
    return <LoadingState title="Loading console" description="Fetching recent automation runs." />

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#18181b]">
        <div className="border-b border-[rgba(255,255,255,0.06)] p-4">
          <p className="text-sm font-medium text-[#fafafa]">Run feed</p>
          <p className="text-xs text-[#909099]">
            {flowId ? `Flow ${flowId}` : "Recent runs across flows"}
          </p>
        </div>
        {error && (
          <div className="p-4">
            <ErrorState compact title="Console unavailable" description={error} />
          </div>
        )}
        {runs.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No runs yet"
              description="Runs will appear here after a rule is triggered."
            />
          </div>
        ) : (
          <div className="divide-y divide-[rgba(255,255,255,0.06)]">
            {runs.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => setSelectedRunId(run.id)}
                className={`block w-full p-4 text-left transition-colors ${
                  run.id === selectedRunId
                    ? "bg-[rgba(255,255,255,0.05)]"
                    : "hover:bg-[rgba(255,255,255,0.03)]"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-sm text-[#fafafa]">
                    <span className={`h-2 w-2 rounded-full ${statusDot(run.status)}`} />
                    {run.status}
                  </span>
                  <span className="text-xs text-[#909099]">{runDuration(run)}</span>
                </div>
                <p className="truncate font-mono text-xs text-[#a1a1aa]">{run.flow_id}</p>
                <p className="mt-1 text-xs text-[#909099]">{run.trigger_event}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedRun ? (
        <RunInspector run={selectedRun} />
      ) : (
        <EmptyState
          title="Select a run"
          description="Choose a run to inspect timing, inputs, outputs, and errors."
        />
      )}
    </div>
  )
}
