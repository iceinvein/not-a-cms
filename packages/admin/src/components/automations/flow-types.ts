export type {
  ActionStep,
  ActionType,
  ConditionOperator,
  ConditionRule,
  ConditionStep,
  DryRunResult,
  DryRunStep,
  Flow,
  FlowRun,
  FlowRunStatus,
  FlowRunStep,
  FlowRunStepStatus,
  FlowStep,
  FlowTrigger,
} from "@not-a-cms/core"

import type { FlowRun, FlowRunStep } from "@not-a-cms/core"

export type FlowRunDetail = FlowRun & {
  steps: FlowRunStep[]
}
