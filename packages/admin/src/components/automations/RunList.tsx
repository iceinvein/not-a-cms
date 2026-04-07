import type { FlowStep } from "./flow-types"

type Props = {
  flowId: string
  apiBase?: string
  steps: FlowStep[]
}

export function RunList({ flowId }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
      Run history will appear here.
    </div>
  )
}
