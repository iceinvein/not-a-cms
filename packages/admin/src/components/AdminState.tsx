import { AlertCircle, CircleDashed, Inbox, Lock } from "lucide-react"
import type { ReactNode } from "react"

type StateProps = {
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
}

type ForbiddenStateProps = {
  title?: string
  description?: string
  action?: ReactNode
  compact?: boolean
}

const tone = {
  neutral: "border-[rgba(255,255,255,0.06)] bg-[#18181b]",
  danger: "border-[rgba(239,68,68,0.16)] bg-[rgba(239,68,68,0.06)]",
}

export function LoadingState({ title, description, compact = false }: StateProps) {
  return (
    <div className={`${tone.neutral} rounded-lg border ${compact ? "px-4 py-3" : "p-6"} text-sm`}>
      <div className="flex items-start gap-3">
        <CircleDashed className="mt-0.5 h-4 w-4 animate-spin text-[#71717a]" />
        <div>
          <p className="font-medium text-[#fafafa]">{title}</p>
          {description && <p className="mt-1 text-[#71717a]">{description}</p>}
        </div>
      </div>
    </div>
  )
}

export function EmptyState({ title, description, action, compact = false }: StateProps) {
  return (
    <div
      className={`${tone.neutral} rounded-lg border ${compact ? "px-4 py-5" : "p-8"} text-center`}
    >
      <Inbox className="mx-auto mb-3 h-5 w-5 text-[#71717a]" />
      <p className="text-sm font-medium text-[#fafafa]">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-[#71717a]">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ title, description, action, compact = false }: StateProps) {
  return (
    <div className={`${tone.danger} rounded-lg border ${compact ? "px-4 py-3" : "p-6"}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 text-[#ef4444]" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#ef4444]">{title}</p>
          {description && <p className="mt-1 text-sm text-[#fca5a5]">{description}</p>}
          {action && <div className="mt-4">{action}</div>}
        </div>
      </div>
    </div>
  )
}

/**
 * Neutral "you need a higher role" notice. Distinct from ErrorState: a missing
 * permission is an expected outcome for non-admins, not a failure, so it reads
 * calm rather than alarming (no red danger styling).
 */
export function ForbiddenState({
  title = "Admin access required",
  description = "This area is limited to administrators. Ask an administrator to grant you access.",
  action,
  compact = false,
}: ForbiddenStateProps) {
  return (
    <div
      className={`${tone.neutral} rounded-lg border ${compact ? "px-4 py-5" : "p-8"} text-center`}
    >
      <Lock className="mx-auto mb-3 h-5 w-5 text-[#71717a]" />
      <p className="text-sm font-medium text-[#fafafa]">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-[#71717a]">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
