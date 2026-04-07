import type { FlowStep, FlowTrigger } from "./flow-types"

type Props = {
  selectedStep: FlowStep | null
  showTriggerConfig: boolean
  trigger: FlowTrigger
  onUpdateStep: (id: string, updates: Partial<FlowStep>) => void
  onUpdateTrigger: (trigger: FlowTrigger) => void
  onClose: () => void
}

export function StepConfigurator({ selectedStep, showTriggerConfig }: Props) {
  if (showTriggerConfig) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-500">
        Trigger configuration (E5)
      </div>
    )
  }
  if (!selectedStep) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
        Select a step to configure it.
      </div>
    )
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-500">
      Step: {selectedStep.type} (E5)
    </div>
  )
}
