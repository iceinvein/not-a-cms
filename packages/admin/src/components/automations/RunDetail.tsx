import { useState, useEffect } from "react"
import type { FlowStep, FlowRun, FlowRunStep } from "./flow-types"
import { FlowCanvas } from "./FlowCanvas"

type Props = {
  flowId: string
  runId: string
  apiBase?: string
  steps: FlowStep[]
}

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
  if (value === undefined || value === null) return <span className="text-gray-400 text-xs">—</span>
  return (
    <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-2 overflow-auto max-h-48 whitespace-pre-wrap break-all">
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
          <p className="text-xs text-gray-500 font-mono">{runStep.step_id}</p>
          {stepDef && (
            <p className="text-sm font-medium text-gray-800 mt-0.5">
              {stepDef.type}
            </p>
          )}
        </div>
        <span className={statusBadge(runStep.status)}>{runStep.status}</span>
      </div>

      {runStep.branch_taken && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Branch taken</p>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
            {runStep.branch_taken}
          </span>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Duration</p>
        <p className="text-sm text-gray-800">{stepDurationMs(runStep.started_at, runStep.finished_at)}</p>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Input</p>
        <JsonViewer value={tryParseJson(runStep.input)} />
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Output</p>
        <JsonViewer value={tryParseJson(runStep.output)} />
      </div>

      {runStep.error && (
        <div>
          <p className="text-xs font-medium text-red-500 mb-1">Error</p>
          <pre className="text-xs bg-red-50 border border-red-200 rounded-lg p-2 text-red-700 overflow-auto max-h-40 whitespace-pre-wrap break-all">
            {runStep.error}
          </pre>
        </div>
      )}
    </div>
  )
}

export function RunDetail({ flowId, runId, apiBase = "", steps }: Props) {
  const [run, setRun] = useState<FlowRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`${apiBase}/api/_flows/${flowId}/runs/${runId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: FlowRun | null) => setRun(data))
      .catch(() => setRun(null))
      .finally(() => setLoading(false))
  }, [flowId, runId, apiBase])

  if (loading) {
    return <p className="text-gray-400 text-sm text-center py-12">Loading run details…</p>
  }

  if (!run) {
    return <p className="text-red-500 text-sm text-center py-12">Run not found.</p>
  }

  const runStepsForCanvas = (run.steps ?? []).map((rs) => ({
    step_id: rs.step_id,
    status: rs.status,
    branch_taken: rs.branch_taken,
  }))

  const selectedRunStep = run.steps?.find((rs) => rs.step_id === selectedStepId) ?? null

  return (
    <div className="flex flex-col gap-4">
      {/* Run info bar */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap items-center gap-4">
        <div>
          <p className="text-xs text-gray-500">Started</p>
          <p className="text-sm font-medium text-gray-800">
            {new Date(run.started_at).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Trigger event</p>
          <p className="text-sm font-mono text-gray-700">{run.trigger_event}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Duration</p>
          <p className="text-sm text-gray-800">{formatDuration(run.started_at, run.finished_at)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Status</p>
          <span className={statusBadge(run.status)}>{run.status}</span>
        </div>
      </div>

      {/* Error banner */}
      {run.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <span className="font-semibold">Error: </span>
          {run.error}
        </div>
      )}

      {/* Main: canvas + detail panel */}
      <div className="flex gap-4 items-start">
        {/* Left: flow canvas in readOnly mode */}
        <div className="flex-1 bg-gray-50 rounded-xl border border-gray-200 min-h-[400px] overflow-y-auto">
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
        <div className="w-80 flex-shrink-0 bg-white rounded-xl border border-gray-200 p-4">
          {selectedRunStep ? (
            <StepDetailPanel runStep={selectedRunStep} steps={steps} />
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">
              Click a step to see its execution data.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
