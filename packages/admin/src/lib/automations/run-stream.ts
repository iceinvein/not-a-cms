import type { FlowRun, FlowRunStep, FlowRunDetail } from "../../components/automations/flow-types"

/** Matches the server's cross-flow runs feed `limit`. */
export const FEED_LIMIT = 50

/** Insert a run at the top of the feed, or update it in place if already
 *  present (so a completing run does not jump position). Caps the feed. */
export function upsertRun(runs: FlowRun[], run: FlowRun, limit = FEED_LIMIT): FlowRun[] {
  const index = runs.findIndex((existing) => existing.id === run.id)
  if (index >= 0) {
    const next = runs.slice()
    next[index] = run
    return next
  }
  return [run, ...runs].slice(0, limit)
}

/** Apply a step event to the open run: append the step, or replace the
 *  existing one with the same `step_id` (idempotent). No-op if the event is
 *  for a run other than the selected one, or nothing is selected. */
export function applyRunStep(
  selected: FlowRunDetail | null,
  runId: string,
  step: FlowRunStep,
): FlowRunDetail | null {
  if (!selected || selected.id !== runId) return selected
  const steps = selected.steps ?? []
  const index = steps.findIndex((existing) => existing.step_id === step.step_id)
  const nextSteps = index >= 0
    ? steps.map((existing, i) => (i === index ? step : existing))
    : [...steps, step]
  return { ...selected, steps: nextSteps }
}

/** Apply a completion event to the open run's terminal fields. No-op unless
 *  the completed run is the selected one. */
export function applyRunCompleted(
  selected: FlowRunDetail | null,
  run: FlowRun,
): FlowRunDetail | null {
  if (!selected || selected.id !== run.id) return selected
  return { ...selected, status: run.status, finished_at: run.finished_at, error: run.error }
}
