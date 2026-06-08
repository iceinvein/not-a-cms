import { useMemo, useState } from "react"
import { runToTimeline, type TimelineStep } from "../../lib/automations/timeline"
import type { FlowRun, FlowRunDetail } from "./flow-types"

export function statusDot(status: FlowRun["status"] | TimelineStep["status"]): string {
  if (status === "completed") return "bg-[#22c55e]"
  if (status === "failed") return "bg-[#ef4444]"
  if (status === "skipped") return "bg-[#71717a]"
  return "bg-[#f59e0b]"
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function JsonBlock({ value }: { value: unknown }) {
  if (value === undefined || value === null) return null
  return (
    <pre className="max-h-40 overflow-auto rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0a0a0c] p-2 text-xs text-[#a1a1aa]">
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  )
}

export function RunInspector({ run }: { run: FlowRunDetail }) {
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
          <label htmlFor={`scrub-${run.id}`} className="text-xs font-medium text-[#a1a1aa]">
            scrub timeline
          </label>
          <span className="font-mono text-xs text-[#71717a]">
            {formatMs(cursor)} / {formatMs(timeline.totalMs)}
          </span>
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
        {timeline.steps.map((step) => (
          <div
            key={step.stepId}
            className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#111113] p-3"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm text-[#fafafa]">{step.stepId}</p>
                <p className="text-xs text-[#71717a]">
                  {formatMs(step.durationMs)} after +{formatMs(step.offsetMs)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {step.simulated && (
                  <span className="inline-flex items-center rounded-full border border-[rgba(201,149,107,0.4)] bg-[rgba(201,149,107,0.12)] px-2 py-0.5 text-xs text-[#d4a57c]">
                    Simulated
                  </span>
                )}
                <span className="inline-flex items-center gap-2 rounded-full bg-[rgba(255,255,255,0.05)] px-2 py-0.5 text-xs text-[#a1a1aa]">
                  <span className={`h-2 w-2 rounded-full ${statusDot(step.status)}`} />
                  {step.status}
                </span>
              </div>
            </div>
            {step.summary && <p className="mb-2 text-xs text-[#d4a57c]">{step.summary}</p>}
            {step.branchTaken && (
              <p className="mb-2 text-xs text-[#f59e0b]">Branch: {step.branchTaken}</p>
            )}
            {step.error && (
              <p className="mb-2 rounded bg-[rgba(239,68,68,0.1)] px-2 py-1 text-xs text-[#ef4444]">
                {step.error}
              </p>
            )}
            <JsonBlock value={step.input} />
            <JsonBlock value={step.output} />
          </div>
        ))}
      </div>
    </div>
  )
}
