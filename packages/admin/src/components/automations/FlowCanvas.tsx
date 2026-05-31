import { useState } from "react"
import type { FlowTrigger, FlowStep, ActionStep, ConditionStep } from "./flow-types"
import { StepPicker } from "./StepPicker"

type RunStepStatus = {
  step_id: string
  status: string
  branch_taken?: string
}

type Props = {
  trigger: FlowTrigger
  steps: FlowStep[]
  selectedStepId: string | null
  onSelectStep: (id: string | null) => void
  onSelectTrigger: () => void
  onAddStep: (afterIndex: number, step: FlowStep) => void
  onRemoveStep: (id: string) => void
  readOnly?: boolean
  runSteps?: RunStepStatus[]
}

function triggerLabel(trigger: FlowTrigger): string {
  switch (trigger.type) {
    case "content.created": return `Content Created${trigger.collection ? ` (${trigger.collection})` : ""}`
    case "content.updated": return `Content Updated${trigger.collection ? ` (${trigger.collection})` : ""}`
    case "content.published": return `Content Published${trigger.collection ? ` (${trigger.collection})` : ""}`
    case "content.deleted": return `Content Deleted${trigger.collection ? ` (${trigger.collection})` : ""}`
    case "webhook.received": return "Webhook Received"
    case "schedule.cron": return `Cron: ${trigger.cron}`
    default: return "Trigger"
  }
}

function stepLabel(step: FlowStep): string {
  if (step.label) return step.label
  switch (step.type) {
    case "condition": return "Condition"
    case "action.webhook": return "Send Webhook"
    case "action.email": return "Send Email"
    case "action.create_content": return "Create Content"
    case "action.update_content": return "Update Content"
    case "action.delete_content": return "Delete Content"
    case "action.log": return "Log"
    case "action.transform": return "Transform"
    default: return "Step"
  }
}

function makeStep(type: string): FlowStep {
  const id = crypto.randomUUID()
  if (type === "condition") {
    return {
      id,
      type: "condition",
      rules: [],
      match: "all",
      branches: { true: null, false: null },
    } satisfies ConditionStep
  }
  return {
    id,
    type: type as ActionStep["type"],
    config: {},
    next: null,
  } satisfies ActionStep
}

function runStatusColors(status: string): string {
  switch (status) {
    case "completed": return "border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.05)]"
    case "failed": return "border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.05)]"
    case "skipped": return "border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)]"
    default: return "border-[rgba(255,255,255,0.1)] bg-[#18181b]"
  }
}

export function FlowCanvas({
  trigger,
  steps,
  selectedStepId,
  onSelectStep,
  onSelectTrigger,
  onAddStep,
  onRemoveStep,
  readOnly = false,
  runSteps,
}: Props) {
  const [pickerIndex, setPickerIndex] = useState<number | null>(null)

  const handlePickerSelect = (type: string, afterIndex: number) => {
    onAddStep(afterIndex, makeStep(type))
    setPickerIndex(null)
  }

  const getRunStep = (stepId: string) => runSteps?.find((r) => r.step_id === stepId)

  return (
    <div className="flex flex-col items-center py-6 min-h-full">
      {/* Trigger block */}
      <button
        onClick={onSelectTrigger}
        className={`w-80 px-4 py-3 rounded-xl border-2 bg-[#fafafa] text-[#0a0a0c] text-sm font-medium text-center transition-all ${
          selectedStepId === null ? "border-[#fafafa] ring-2 ring-[rgba(255,255,255,0.15)]" : "border-[#fafafa] hover:border-[#e4e4e7]"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide opacity-75 mb-0.5">Trigger</p>
        <p>{triggerLabel(trigger)}</p>
      </button>

      {/* Add button after trigger (index = -1, we use 0 for "before first step") */}
      {!readOnly && (
        <div className="relative flex flex-col items-center">
          <div className="w-0.5 h-6 bg-[rgba(255,255,255,0.1)]" />
          <button
            onClick={() => setPickerIndex(pickerIndex === 0 ? null : 0)}
            className="w-7 h-7 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-[#71717a] hover:bg-[rgba(255,255,255,0.08)] hover:text-[#a1a1aa] hover:border-[rgba(255,255,255,0.15)] text-sm flex items-center justify-center transition-colors"
          >
            +
          </button>
          {pickerIndex === 0 && (
            <StepPicker
              onSelect={(type) => handlePickerSelect(type, 0)}
              onCancel={() => setPickerIndex(null)}
            />
          )}
        </div>
      )}

      {/* Steps */}
      {steps.map((step, index) => {
        const runStep = getRunStep(step.id)
        const isSelected = selectedStepId === step.id
        const isCondition = step.type === "condition"

        let blockClasses = "w-80 px-4 py-3 rounded-xl border-2 text-sm transition-all text-left relative"
        if (readOnly && runStep) {
          blockClasses += ` ${runStatusColors(runStep.status)}`
        } else if (isCondition) {
          blockClasses += " border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.05)] hover:border-[#f59e0b]"
        } else {
          blockClasses += " border-[rgba(255,255,255,0.06)] bg-[#18181b] hover:border-[rgba(255,255,255,0.1)]"
        }
        if (isSelected) {
          blockClasses += " border-[#fafafa] ring-2 ring-[rgba(255,255,255,0.15)]"
        }

        return (
          <div key={step.id} className="flex flex-col items-center">
            <button
              onClick={() => onSelectStep(isSelected ? null : step.id)}
              className={blockClasses}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#52525b] mb-0.5">
                    {isCondition ? "Condition" : "Action"}
                  </p>
                  <p className="font-medium text-[#e4e4e7]">{stepLabel(step)}</p>
                </div>
                {readOnly && runStep && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    runStep.status === "completed" ? "bg-[rgba(34,197,94,0.1)] text-[#22c55e]" :
                    runStep.status === "failed" ? "bg-[rgba(239,68,68,0.1)] text-[#ef4444]" :
                    "bg-[rgba(255,255,255,0.05)] text-[#71717a]"
                  }`}>
                    {runStep.status}
                  </span>
                )}
              </div>
              {isCondition && (runStep?.branch_taken) && (
                <p className="text-xs text-[#f59e0b] mt-1">Branch: {runStep.branch_taken}</p>
              )}
            </button>

            {!readOnly && (
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => onRemoveStep(step.id)}
                  className="text-xs text-[#52525b] hover:text-[#ef4444] transition-colors"
                >
                  Remove
                </button>
              </div>
            )}

            {/* Connector + Add button */}
            <div className="relative flex flex-col items-center">
              <div className="w-0.5 h-6 bg-[rgba(255,255,255,0.1)]" />
              {!readOnly && (
                <>
                  <button
                    onClick={() => setPickerIndex(pickerIndex === index + 1 ? null : index + 1)}
                    className="w-7 h-7 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-[#71717a] hover:bg-[rgba(255,255,255,0.08)] hover:text-[#a1a1aa] hover:border-[rgba(255,255,255,0.15)] text-sm flex items-center justify-center transition-colors"
                  >
                    +
                  </button>
                  {pickerIndex === index + 1 && (
                    <StepPicker
                      onSelect={(type) => handlePickerSelect(type, index + 1)}
                      onCancel={() => setPickerIndex(null)}
                    />
                  )}
                </>
              )}
              {readOnly && <div className="w-0.5 h-6 bg-[rgba(255,255,255,0.1)]" />}
            </div>
          </div>
        )
      })}

      {/* Empty state hint */}
      {steps.length === 0 && !readOnly && (
        <div className="text-center max-w-[240px] mx-auto py-2">
          <p className="text-sm text-[#52525b]">Click the trigger to configure when this flow runs, then use <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-xs text-[#71717a]">+</span> to add steps.</p>
        </div>
      )}

      {/* End node */}
      <div className="px-4 py-1.5 rounded-full bg-[rgba(255,255,255,0.05)] text-xs text-[#52525b] font-medium">End</div>
    </div>
  )
}
