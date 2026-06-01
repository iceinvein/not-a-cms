import { sql } from "drizzle-orm"
import type { AppDatabase } from "../db/connection"
import type { Flow, FlowRun, FlowRunStep, FlowRunStatus, FlowRunStepStatus, CreateFlowInput } from "./types"

export type RecordStepInput = {
  run_id: string
  step_id: string
  status: FlowRunStepStatus
  input?: string
  output?: string
  branch_taken?: string
  error?: string
  started_at?: string
  finished_at?: string
}

export function createFlowStore(db: AppDatabase) {
  function createFlow(input: CreateFlowInput): Flow {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const triggerJson = JSON.stringify(input.trigger)
    const stepsJson = JSON.stringify(input.steps)
    const active = input.active !== false ? 1 : 0
    db.run(sql`INSERT INTO _flows (id, name, description, trigger, steps, active, created_at, updated_at) VALUES (${id}, ${input.name}, ${input.description ?? null}, ${triggerJson}, ${stepsJson}, ${active}, ${now}, ${now})`)
    return getFlowById(id)!
  }

  function listFlows(): Flow[] {
    const rows = db.all(sql`SELECT * FROM _flows ORDER BY created_at DESC`)
    return (rows as any[]).map(parseFlowRow)
  }

  function getFlowById(id: string): Flow | null {
    const rows = db.all(sql`SELECT * FROM _flows WHERE id = ${id}`)
    const row = (rows as any[])[0]
    return row ? parseFlowRow(row) : null
  }

  function updateFlow(id: string, data: Partial<CreateFlowInput>): Flow | null {
    const existing = getFlowById(id)
    if (!existing) return null
    const merged = { ...existing, ...data }
    const now = new Date().toISOString()
    const active = merged.active ? 1 : 0
    db.run(sql`UPDATE _flows SET name = ${merged.name}, description = ${merged.description ?? null}, trigger = ${JSON.stringify(merged.trigger)}, steps = ${JSON.stringify(merged.steps)}, active = ${active}, updated_at = ${now} WHERE id = ${id}`)
    return getFlowById(id)
  }

  function deleteFlow(id: string): boolean {
    // Cascade: delete run_steps first, then runs, then flow
    const runs = db.all(sql`SELECT id FROM _flow_runs WHERE flow_id = ${id}`) as Array<{ id: string }>
    for (const run of runs) {
      db.run(sql`DELETE FROM _flow_run_steps WHERE run_id = ${run.id}`)
    }
    db.run(sql`DELETE FROM _flow_runs WHERE flow_id = ${id}`)
    db.run(sql`DELETE FROM _flows WHERE id = ${id}`)
    return true
  }

  function toggleFlow(id: string): Flow | null {
    const existing = getFlowById(id)
    if (!existing) return null
    const now = new Date().toISOString()
    const newActive = existing.active ? 0 : 1
    db.run(sql`UPDATE _flows SET active = ${newActive}, updated_at = ${now} WHERE id = ${id}`)
    return getFlowById(id)
  }

  function getActiveFlowsByTrigger(triggerType: string): Flow[] {
    const rows = db.all(sql`SELECT * FROM _flows WHERE active = 1`) as any[]
    return rows.map(parseFlowRow).filter(flow => flow.trigger.type === triggerType)
  }

  function createRun(flowId: string, triggerEvent: string, triggerPayload?: string): FlowRun {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    db.run(sql`INSERT INTO _flow_runs (id, flow_id, trigger_event, trigger_payload, status, started_at) VALUES (${id}, ${flowId}, ${triggerEvent}, ${triggerPayload ?? null}, ${"running"}, ${now})`)
    return getRun(id)!
  }

  function getRun(id: string): FlowRun | null {
    const rows = db.all(sql`SELECT * FROM _flow_runs WHERE id = ${id}`)
    const row = (rows as any[])[0]
    return row ? parseRunRow(row) : null
  }

  function completeRun(id: string, status: FlowRunStatus, error?: string): void {
    const now = new Date().toISOString()
    db.run(sql`UPDATE _flow_runs SET status = ${status}, finished_at = ${now}, error = ${error ?? null} WHERE id = ${id}`)
  }

  function recordStep(input: RecordStepInput): FlowRunStep {
    const id = crypto.randomUUID()
    const startedAt = input.started_at ?? new Date().toISOString()
    const finishedAt = input.finished_at ?? (input.status !== "running" ? new Date().toISOString() : null)
    db.run(sql`INSERT INTO _flow_run_steps (id, run_id, step_id, status, input, output, branch_taken, started_at, finished_at, error) VALUES (${id}, ${input.run_id}, ${input.step_id}, ${input.status}, ${input.input ?? null}, ${input.output ?? null}, ${input.branch_taken ?? null}, ${startedAt}, ${finishedAt}, ${input.error ?? null})`)
    return getRunStep(id)!
  }

  function getRunStep(id: string): FlowRunStep | null {
    const rows = db.all(sql`SELECT * FROM _flow_run_steps WHERE id = ${id}`)
    const row = (rows as any[])[0]
    return row ? parseRunStepRow(row) : null
  }

  function getRunSteps(runId: string): FlowRunStep[] {
    const rows = db.all(sql`SELECT * FROM _flow_run_steps WHERE run_id = ${runId}`)
    return (rows as any[]).map(parseRunStepRow)
  }

  function listRuns(flowId: string, limit = 50, offset = 0): FlowRun[] {
    const rows = db.all(sql`SELECT * FROM _flow_runs WHERE flow_id = ${flowId} ORDER BY started_at DESC LIMIT ${limit} OFFSET ${offset}`)
    return (rows as any[]).map(parseRunRow)
  }

  function listRecentRuns(opts: { status?: FlowRunStatus; limit?: number; offset?: number } = {}): FlowRun[] {
    const limit = opts.limit ?? 50
    const offset = opts.offset ?? 0
    const rows = opts.status
      ? db.all(sql`SELECT * FROM _flow_runs WHERE status = ${opts.status} ORDER BY started_at DESC, rowid DESC LIMIT ${limit} OFFSET ${offset}`)
      : db.all(sql`SELECT * FROM _flow_runs ORDER BY started_at DESC, rowid DESC LIMIT ${limit} OFFSET ${offset}`)
    return (rows as any[]).map(parseRunRow)
  }

  function purgeOldRuns(retentionDays: number): number {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()
    const oldRuns = db.all(sql`SELECT id FROM _flow_runs WHERE started_at < ${cutoff}`) as Array<{ id: string }>
    for (const run of oldRuns) {
      db.run(sql`DELETE FROM _flow_run_steps WHERE run_id = ${run.id}`)
    }
    db.run(sql`DELETE FROM _flow_runs WHERE started_at < ${cutoff}`)
    return oldRuns.length
  }

  return {
    createFlow,
    listFlows,
    getFlowById,
    updateFlow,
    deleteFlow,
    toggleFlow,
    getActiveFlowsByTrigger,
    createRun,
    getRun,
    completeRun,
    recordStep,
    getRunSteps,
    listRuns,
    listRecentRuns,
    purgeOldRuns,
  }
}

function parseFlowRow(row: any): Flow {
  return {
    ...row,
    active: Boolean(row.active),
    trigger: typeof row.trigger === "string" ? JSON.parse(row.trigger) : row.trigger,
    steps: typeof row.steps === "string" ? JSON.parse(row.steps) : row.steps,
  }
}

function parseRunRow(row: any): FlowRun {
  return {
    ...row,
    trigger_payload: row.trigger_payload ?? undefined,
    finished_at: row.finished_at ?? undefined,
    error: row.error ?? undefined,
  }
}

function parseRunStepRow(row: any): FlowRunStep {
  return {
    ...row,
    input: row.input ?? undefined,
    output: row.output ?? undefined,
    branch_taken: row.branch_taken ?? undefined,
    finished_at: row.finished_at ?? undefined,
    error: row.error ?? undefined,
  }
}

export type FlowStore = ReturnType<typeof createFlowStore>
