import { useEffect, useMemo, useState } from "react"
import type { FlowRun, FlowRunDetail } from "./flow-types"
import { runToTimeline, type TimelineStep } from "../../lib/automations/timeline"
import { adminApiFetch, messageForAdminResponse } from "../../lib/api"
import { EmptyState, ErrorState, LoadingState } from "../AdminState"

type Props = {
  apiBase?: string
  flowId?: string
  initialRuns?: FlowRun[]
  initialSelected?: FlowRunDetail
  initialSelectedRunId?: string
}

function statusDot(status: FlowRun["status"] | TimelineStep["status"]): string {
  if (status === "completed") return "bg-[#22c55e]"
  if (status === "failed") return "bg-[#ef4444]"
  if (status === "skipped") return "bg-[#71717a]"
  return "bg-[#f59e0b]"
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function runDuration(run: FlowRun): string {
  if (!run.finished_at) return "running"
  return formatMs(Math.max(0, new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()))
}

function JsonBlock({ value }: { value: unknown }) {
  if (value === undefined || value === null) return null
  return (
    <pre className="max-h-40 overflow-auto rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0a0a0c] p-2 text-xs text-[#a1a1aa]">
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  )
}

function Inspector({ run }: { run: FlowRunDetail }) {
  const [cursor, setCursor] = useState(0)
  const timeline = useMemo(() => runToTimeline(run), [run])
  const max = Math.max(timeline.totalMs, 1)

  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#18181b] p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[#71717a]">Selected run</p>
          <p className="font-mono text-sm text-[#fafafa]">{run.id}</p>
          <p className="mt-1 text-sm text-[#a1a1aa]">{run.trigger_event}</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.1)] px-2 py-1 text-xs text-[#e4e4e7]">
          <span className={`h-2 w-2 rounded-full ${statusDot(run.status)}`} />
          {run.status}
        </span>
      </div>

      <div className="mb-5 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#111113] p-3">
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor={`scrub-${run.id}`} className="text-xs font-medium text-[#a1a1aa]">scrub timeline</label>
          <span className="font-mono text-xs text-[#71717a]">{formatMs(cursor)} / {formatMs(timeline.totalMs)}</span>
        </div>
        <input
          id={`scrub-${run.id}`}
          aria-label="scrub timeline"
          type="range"
          min={0}
          max={max}
          value={Math.min(cursor, max)}
          onChange={(event) => setCursor(Number(event.target.value))}
          className="w-full accent-[#c9956b]"
        />
        <div className="relative mt-3 h-5 rounded-full bg-[#0a0a0c]">
          {timeline.steps.map((step) => (
            <span
              key={step.stepId}
              title={`${step.stepId}: ${step.status}`}
              className={`absolute top-1 h-3 w-3 rounded-full ${statusDot(step.status)}`}
              style={{ left: `${Math.min(96, (step.offsetMs / max) * 100)}%` }}
            />
          ))}
        </div>
      </div>

      {run.error && (
        <div className="mb-4 rounded-lg border border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.1)] p-3 text-sm text-[#ef4444]">
          {run.error}
        </div>
      )}

      <div className="space-y-3">
        {timeline.steps.map((step, index) => (
          <div key={`${step.stepId}-${index}`} className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#111113] p-3">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm text-[#fafafa]">{step.stepId}</p>
                <p className="text-xs text-[#71717a]">{formatMs(step.durationMs)} after +{formatMs(step.offsetMs)}</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[rgba(255,255,255,0.05)] px-2 py-0.5 text-xs text-[#a1a1aa]">
                <span className={`h-2 w-2 rounded-full ${statusDot(step.status)}`} />
                {step.status}
              </span>
            </div>
            {step.branchTaken && <p className="mb-2 text-xs text-[#f59e0b]">Branch: {step.branchTaken}</p>}
            {step.error && <p className="mb-2 rounded bg-[rgba(239,68,68,0.1)] px-2 py-1 text-xs text-[#ef4444]">{step.error}</p>}
            <JsonBlock value={step.input} />
            <JsonBlock value={step.output} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function Console({ apiBase = "", flowId, initialRuns, initialSelected, initialSelectedRunId }: Props) {
  const [runs, setRuns] = useState<FlowRun[]>(initialRuns ?? [])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(initialSelected?.id ?? initialSelectedRunId ?? initialRuns?.[0]?.id ?? null)
  const [selectedRun, setSelectedRun] = useState<FlowRunDetail | null>(initialSelected ?? null)
  const [loading, setLoading] = useState(!initialRuns)
  const [error, setError] = useState("")

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

  useEffect(() => {
    if (!initialRuns) fetchRuns()
  }, [apiBase])

  useEffect(() => {
    const run = runs.find((item) => item.id === selectedRunId)
    if (!run) return
    if (selectedRun?.id !== run.id || !selectedRun.steps) fetchSelected(run)
  }, [selectedRunId, runs, apiBase])

  useEffect(() => {
    if (!selectedRun || selectedRun.status !== "running") return
    const id = setInterval(() => {
      const run = runs.find((item) => item.id === selectedRun.id)
      if (run) fetchSelected(run)
    }, 2000)
    return () => clearInterval(id)
  }, [selectedRun, runs, apiBase])

  if (loading) return <LoadingState title="Loading console" description="Fetching recent automation runs." />

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#18181b]">
        <div className="border-b border-[rgba(255,255,255,0.06)] p-4">
          <p className="text-sm font-medium text-[#fafafa]">Run feed</p>
          <p className="text-xs text-[#71717a]">{flowId ? `Flow ${flowId}` : "Recent runs across flows"}</p>
        </div>
        {error && <div className="p-4"><ErrorState compact title="Console unavailable" description={error} /></div>}
        {runs.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No runs yet" description="Runs will appear here after a rule is triggered." />
          </div>
        ) : (
          <div className="divide-y divide-[rgba(255,255,255,0.06)]">
            {runs.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => setSelectedRunId(run.id)}
                className={`block w-full p-4 text-left transition-colors ${
                  run.id === selectedRunId ? "bg-[rgba(255,255,255,0.05)]" : "hover:bg-[rgba(255,255,255,0.03)]"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-sm text-[#fafafa]">
                    <span className={`h-2 w-2 rounded-full ${statusDot(run.status)}`} />
                    {run.status}
                  </span>
                  <span className="text-xs text-[#71717a]">{runDuration(run)}</span>
                </div>
                <p className="truncate font-mono text-xs text-[#a1a1aa]">{run.flow_id}</p>
                <p className="mt-1 text-xs text-[#71717a]">{run.trigger_event}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedRun ? (
        <Inspector run={selectedRun} />
      ) : (
        <EmptyState title="Select a run" description="Choose a run to inspect timing, inputs, outputs, and errors." />
      )}
    </div>
  )
}
