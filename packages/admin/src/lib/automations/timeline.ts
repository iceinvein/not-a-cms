import type { FlowRunDetail, FlowRunStep } from "../../components/automations/flow-types"

export type TimelineStep = {
  stepId: string
  status: FlowRunStep["status"]
  startedAt: string
  finishedAt?: string
  durationMs: number
  offsetMs: number
  input?: unknown
  output?: unknown
  error?: string
  branchTaken?: string
}

export type RunTimeline = {
  steps: TimelineStep[]
  totalMs: number
  failingStepId: string | null
}

function parseJson(raw?: string): unknown {
  if (!raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

export function runToTimeline(run: FlowRunDetail): RunTimeline {
  const runStart = new Date(run.started_at).getTime()
  const steps = [...(run.steps ?? [])]
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
    .map((step) => {
      const start = new Date(step.started_at).getTime()
      const end = step.finished_at ? new Date(step.finished_at).getTime() : start
      return {
        stepId: step.step_id,
        status: step.status,
        startedAt: step.started_at,
        finishedAt: step.finished_at,
        durationMs: Math.max(0, end - start),
        offsetMs: Math.max(0, start - runStart),
        input: parseJson(step.input),
        output: parseJson(step.output),
        error: step.error,
        branchTaken: step.branch_taken,
      } satisfies TimelineStep
    })

  const runEnd = run.finished_at ? new Date(run.finished_at).getTime() : runStart
  const totalMs = Math.max(0, runEnd - runStart)
  const failing = steps.find((step) => step.status === "failed")

  return {
    steps,
    totalMs,
    failingStepId: failing?.stepId ?? null,
  }
}
