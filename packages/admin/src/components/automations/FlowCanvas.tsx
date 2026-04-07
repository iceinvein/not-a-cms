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
    default: return step.type
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
    case "completed": return "border-green-400 bg-green-50"
    case "failed": return "border-red-400 bg-red-50"
    case "skipped": return "border-gray-300 bg-gray-50"
    default: return "border-gray-300 bg-white"
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
        className={`w-80 px-4 py-3 rounded-xl border-2 bg-blue-600 text-white text-sm font-medium text-center transition-all shadow-sm ${
          selectedStepId === null ? "border-blue-800 ring-2 ring-blue-300" : "border-blue-600 hover:border-blue-800"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide opacity-75 mb-0.5">Trigger</p>
        <p>{triggerLabel(trigger)}</p>
      </button>

      {/* Add button after trigger (index = -1, we use 0 for "before first step") */}
      {!readOnly && (
        <div className="relative flex flex-col items-center">
          <div className="w-0.5 h-6 bg-gray-300" />
          <button
            onClick={() => setPickerIndex(pickerIndex === 0 ? null : 0)}
            className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 text-gray-400 hover:bg-blue-50 hover:text-blue-500 hover:border-blue-200 text-sm flex items-center justify-center transition-colors"
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

        let blockClasses = "w-80 px-4 py-3 rounded-xl border-2 text-sm transition-all text-left relative shadow-sm"
        if (readOnly && runStep) {
          blockClasses += ` ${runStatusColors(runStep.status)}`
        } else if (isCondition) {
          blockClasses += " border-amber-300 bg-amber-50 hover:border-amber-400"
        } else {
          blockClasses += " border-gray-200 bg-white hover:border-gray-300"
        }
        if (isSelected) {
          blockClasses += " border-blue-500 ring-2 ring-blue-200"
        }

        return (
          <div key={step.id} className="flex flex-col items-center">
            <button
              onClick={() => onSelectStep(isSelected ? null : step.id)}
              className={blockClasses}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">
                    {isCondition ? "Condition" : "Action"}
                  </p>
                  <p className="font-medium text-gray-800">{stepLabel(step)}</p>
                </div>
                {readOnly && runStep && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    runStep.status === "completed" ? "bg-green-100 text-green-700" :
                    runStep.status === "failed" ? "bg-red-100 text-red-700" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {runStep.status}
                  </span>
                )}
              </div>
              {isCondition && (runStep?.branch_taken) && (
                <p className="text-xs text-amber-600 mt-1">Branch: {runStep.branch_taken}</p>
              )}
            </button>

            {!readOnly && (
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => onRemoveStep(step.id)}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Remove
                </button>
              </div>
            )}

            {/* Connector + Add button */}
            <div className="relative flex flex-col items-center">
              <div className="w-0.5 h-6 bg-gray-300" />
              {!readOnly && (
                <>
                  <button
                    onClick={() => setPickerIndex(pickerIndex === index + 1 ? null : index + 1)}
                    className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 text-gray-400 hover:bg-blue-50 hover:text-blue-500 hover:border-blue-200 text-sm flex items-center justify-center transition-colors"
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
              {readOnly && <div className="w-0.5 h-6 bg-gray-300" />}
            </div>
          </div>
        )
      })}

      {/* Empty state hint */}
      {steps.length === 0 && !readOnly && (
        <div className="text-center max-w-[240px] mx-auto py-2">
          <p className="text-sm text-gray-400">Click the trigger to configure when this flow runs, then use <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 border border-gray-200 text-xs text-gray-500">+</span> to add steps.</p>
        </div>
      )}

      {/* End node */}
      <div className="px-4 py-1.5 rounded-full bg-gray-200 text-xs text-gray-500 font-medium">End</div>
    </div>
  )
}
