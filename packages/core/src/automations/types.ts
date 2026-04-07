export type FlowTrigger =
  | { type: "content.created"; collection?: string }
  | { type: "content.updated"; collection?: string }
  | { type: "content.published"; collection?: string }
  | { type: "content.deleted"; collection?: string }
  | { type: "webhook.received" }
  | { type: "schedule.cron"; cron: string }

export type ConditionOperator = "eq" | "neq" | "contains" | "not_contains" | "matches" | "gt" | "lt"

export type ConditionRule = {
  field: string
  operator: ConditionOperator
  value: string | number | boolean
}

export type ConditionStep = {
  id: string
  type: "condition"
  label?: string
  rules: ConditionRule[]
  match: "all" | "any"
  branches: {
    true: string | null
    false: string | null
  }
}

export type ActionType =
  | "action.webhook"
  | "action.email"
  | "action.create_content"
  | "action.update_content"
  | "action.delete_content"
  | "action.log"
  | "action.transform"

export type ActionStep = {
  id: string
  type: ActionType
  label?: string
  config: Record<string, unknown>
  next: string | null
}

export type FlowStep = ConditionStep | ActionStep

export type Flow = {
  id: string
  name: string
  description?: string
  active: boolean
  trigger: FlowTrigger
  steps: FlowStep[]
  created_at: string
  updated_at: string
}

export type FlowRunStatus = "running" | "completed" | "failed"
export type FlowRunStepStatus = "running" | "completed" | "failed" | "skipped"

export type FlowRun = {
  id: string
  flow_id: string
  trigger_event: string
  trigger_payload?: string
  status: FlowRunStatus
  started_at: string
  finished_at?: string
  error?: string
}

export type FlowRunStep = {
  id: string
  run_id: string
  step_id: string
  status: FlowRunStepStatus
  input?: string
  output?: string
  branch_taken?: string
  started_at: string
  finished_at?: string
  error?: string
}

export type CreateFlowInput = {
  name: string
  description?: string
  trigger: FlowTrigger
  steps: FlowStep[]
  active?: boolean
}

export type TriggerPayload = {
  event: string
  collection?: string
  document?: Record<string, unknown>
  body?: unknown
  headers?: Record<string, string>
  timestamp?: string
}
