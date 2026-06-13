import { useEffect, useState } from "react"
import { adminApiFetch } from "../../lib/api"
import { ErrorState, LoadingState } from "../AdminState"
import { FlowCanvas } from "./FlowCanvas"
import type { FlowRunDetail, FlowRunStep, FlowStep } from "./flow-types"

type Props = {
  flowId: string
  runId: string
  apiBase?: string
  steps: FlowStep[]
  onRetry?: (runId: string) => void
}

function statusBadge(status: string) {
  const base = "inline-block text-xs px-2 py-0.5 rounded-full font-medium"
  if (status === "completed") return `${base} bg-[rgba(34,197,94,0.1)] text-[#22c55e]`
  if (status === "failed") return `${base} bg-[rgba(239,68,68,0.1)] text-[#ef4444]`
  return `${base} bg-[rgba(255,255,255,0.05)] text-[#71717a]`
}

function formatDuration(started: string, finished?: string): string {
  if (!finished) return "—"
  const ms = new Date(finished).getTime() - new Date(started).getTime()
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function stepDurationMs(started: string, finished?: string): string {
  if (!finished) return "—"
  return `${new Date(finished).getTime() - new Date(started).getTime()}ms`
}

function tryParseJson(raw?: string): unknown {
  if (!raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function JsonViewer({ value }: { value: unknown }) {
  if (value === undefined || value === null)
    return <span className="text-[#52525b] text-xs">—</span>
  return (
    <pre className="text-xs bg-[#0a0a0c] border border-[rgba(255,255,255,0.06)] rounded-lg p-2 overflow-auto max-h-48 whitespace-pre-wrap break-all text-[#a1a1aa]">
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  )
}

function StepDetailPanel({ runStep, steps }: { runStep: FlowRunStep; steps: FlowStep[] }) {
  const stepDef = steps.find((s) => s.id === runStep.step_id)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-[#71717a] font-mono">{runStep.step_id}</p>
          {stepDef && <p className="text-sm font-medium text-[#fafafa] mt-0.5">{stepDef.type}</p>}
        </div>
        <span className={statusBadge(runStep.status)}>{runStep.status}</span>
      </div>

      {runStep.branch_taken && (
        <div>
          <p className="text-xs font-medium text-[#71717a] mb-1">Branch taken</p>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(245,158,11,0.1)] text-[#f59e0b] font-medium">
            {runStep.branch_taken}
          </span>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-[#71717a] mb-1">Duration</p>
        <p className="text-sm text-[#fafafa]">
          {stepDurationMs(runStep.started_at, runStep.finished_at)}
        </p>
      </div>

      <div>
        <p className="text-xs font-medium text-[#71717a] mb-1">Input</p>
        <JsonViewer value={tryParseJson(runStep.input)} />
      </div>

      <div>
        <p className="text-xs font-medium text-[#71717a] mb-1">Output</p>
        <JsonViewer value={tryParseJson(runStep.output)} />
      </div>

      {runStep.error && (
        <div>
          <p className="text-xs font-medium text-[#ef4444] mb-1">Error</p>
          <pre className="text-xs bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-lg p-2 text-[#ef4444] overflow-auto max-h-40 whitespace-pre-wrap break-all">
            {runStep.error}
          </pre>
        </div>
      )}
    </div>
  )
}

export function RunDetail({ flowId, runId, apiBase = "", steps, onRetry }: Props) {
  const [run, setRun] = useState<FlowRunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState("")

  useEffect(() => {
    setLoading(true)
    adminApiFetch(apiBase, `/api/_flows/${flowId}/runs/${runId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: FlowRunDetail | null) => setRun(data))
      .catch(() => setRun(null))
      .finally(() => setLoading(false))
  }, [flowId, runId, apiBase])

  if (loading) {
    return (
      <LoadingState
        title="Loading run details"
        description="Fetching step inputs, outputs, and timing."
      />
    )
  }

  if (!run) {
    return (
      <ErrorState
        title="Run not found"
        description="The run may have been removed or is no longer available."
      />
    )
  }

  const runStepsForCanvas = (run.steps ?? []).map((rs) => ({
    step_id: rs.step_id,
    status: rs.status,
    branch_taken: rs.branch_taken,
  }))

  const selectedRunStep = run.steps?.find((rs) => rs.step_id === selectedStepId) ?? null

  const handleRetry = async () => {
    setRetrying(true)
    setRetryError("")
    try {
      const res = await adminApiFetch(apiBase, `/api/_flows/${flowId}/runs/${runId}/retry`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Could not retry run.")
      const body = await res.json()
      if (typeof body.runId === "string") onRetry?.(body.runId)
    } catch (err: any) {
      setRetryError(err.message || "Could not retry run.")
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Run info bar */}
      <div className="bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] px-4 py-3 flex flex-wrap items-center gap-4">
        <div>
          <p className="text-xs text-[#71717a]">Started</p>
          <p className="text-sm font-medium text-[#fafafa]">
            {new Date(run.started_at).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#71717a]">Trigger event</p>
          <p className="text-sm font-mono text-[#a1a1aa]">{run.trigger_event}</p>
        </div>
        <div>
          <p className="text-xs text-[#71717a]">Duration</p>
          <p className="text-sm text-[#fafafa]">
            {formatDuration(run.started_at, run.finished_at)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#71717a] mb-0.5">Status</p>
          <span className={statusBadge(run.status)}>{run.status}</span>
        </div>
        {run.status === "failed" && (
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="ml-auto px-3 py-1.5 bg-[#c6ff3d] text-[#0a0a0c] rounded-lg text-sm font-medium hover:bg-[#d4ff6e] disabled:opacity-50 transition-colors"
          >
            {retrying ? "Retrying..." : "Retry Run"}
          </button>
        )}
      </div>

      {/* Error banner */}
      {run.error && (
        <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] rounded-xl px-4 py-3 text-sm text-[#ef4444]">
          <span className="font-semibold">Error: </span>
          {run.error}
        </div>
      )}

      {retryError && <ErrorState compact title="Retry failed" description={retryError} />}

      {/* Main: canvas + detail panel */}
      <div className="flex gap-4 items-start">
        {/* Left: flow canvas in readOnly mode */}
        <div className="flex-1 bg-[#0a0a0c] rounded-xl border border-[rgba(255,255,255,0.06)] min-h-[400px] overflow-y-auto">
          <FlowCanvas
            trigger={{ type: "content.created" }}
            steps={steps}
            selectedStepId={selectedStepId}
            onSelectStep={(id) => setSelectedStepId(id)}
            onSelectTrigger={() => setSelectedStepId(null)}
            onAddStep={() => {}}
            onRemoveStep={() => {}}
            readOnly
            runSteps={runStepsForCanvas}
          />
        </div>

        {/* Right: step detail panel */}
        <div className="w-80 flex-shrink-0 bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] p-4">
          {selectedRunStep ? (
            <StepDetailPanel runStep={selectedRunStep} steps={steps} />
          ) : (
            <p className="text-sm text-[#52525b] text-center py-8">
              Click a step to see its execution data.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
