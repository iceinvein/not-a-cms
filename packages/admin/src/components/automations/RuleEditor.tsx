import { useMemo, useState } from "react"
import { adminApiFetch, messageForAdminResponse } from "../../lib/api"
import { flowToOutline } from "../../lib/automations/outline"
import { ErrorState } from "../AdminState"
import type {
  ActionStep,
  ActionType,
  ConditionStep,
  Flow,
  FlowStep,
  FlowTrigger,
} from "./flow-types"
import { StepConfigurator } from "./StepConfigurator"
import { TestPanel } from "./TestPanel"

type Props = {
  flow: Flow
  apiBase?: string
  onSaved?: (flow: Flow) => void
}

type EditTarget =
  | { type: "trigger" }
  | { type: "condition"; id: string }
  | { type: "action"; id: string }
  | null

const ACTION_TYPES: Array<{ type: ActionType; label: string }> = [
  { type: "action.webhook", label: "Send webhook" },
  { type: "action.email", label: "Send email" },
  { type: "action.create_content", label: "Create content" },
  { type: "action.update_content", label: "Update content" },
  { type: "action.delete_content", label: "Delete content" },
  { type: "action.log", label: "Log" },
  { type: "action.transform", label: "Transform" },
]

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function defaultAction(type: ActionType): ActionStep {
  return { id: newId("action"), type, config: {}, next: null }
}

function defaultCondition(nextActionId: string | null): ConditionStep {
  return {
    id: newId("condition"),
    type: "condition",
    rules: [{ field: "", operator: "eq", value: "" }],
    match: "all",
    branches: { true: nextActionId, false: null },
  }
}

function actionLabel(action: ActionStep): string {
  return action.label ?? action.type.replace("action.", "").replace(/_/g, " ")
}

function normalizeActionConfig(action: ActionStep): ActionStep {
  if (action.type !== "action.update_content" && action.type !== "action.delete_content")
    return action
  const { document_id, ...rest } = action.config as Record<string, unknown>
  return {
    ...action,
    config: {
      ...rest,
      documentId: rest.documentId ?? document_id ?? "",
    },
  }
}

function normalizeSteps(steps: FlowStep[]): FlowStep[] {
  const condition = steps.find((step): step is ConditionStep => step.type === "condition")
  const actions = steps
    .filter((step): step is ActionStep => step.type.startsWith("action."))
    .map(normalizeActionConfig)

  const linkedActions = actions.map((action, index) => ({
    ...action,
    next: actions[index + 1]?.id ?? null,
  }))

  if (!condition) return linkedActions

  return [
    {
      ...condition,
      branches: {
        true: linkedActions[0]?.id ?? null,
        false: condition.branches.false ?? null,
      },
    },
    ...linkedActions,
  ]
}

function sectionButtonClass(active: boolean): string {
  return `text-left rounded-lg border px-3 py-2 transition-colors ${
    active
      ? "border-[rgba(201,149,107,0.55)] bg-[rgba(201,149,107,0.1)]"
      : "border-[rgba(255,255,255,0.06)] bg-[#111113] hover:border-[rgba(255,255,255,0.12)]"
  }`
}

export function RuleEditor({ flow, apiBase = "", onSaved }: Props) {
  const [draft, setDraft] = useState<Flow>(flow)
  const [selected, setSelected] = useState<EditTarget>({ type: "trigger" })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState("")
  const outline = useMemo(() => flowToOutline(draft), [draft])
  const condition =
    draft.steps.find((step): step is ConditionStep => step.type === "condition") ?? null
  const actions = draft.steps.filter((step): step is ActionStep => step.type.startsWith("action."))

  const updateTrigger = (trigger: FlowTrigger) => {
    setDraft((current) => ({ ...current, trigger }))
  }

  const updateStep = (id: string, updates: Partial<FlowStep>) => {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step) =>
        step.id === id ? ({ ...step, ...updates } as FlowStep) : step,
      ),
    }))
  }

  const addCondition = () => {
    if (condition) {
      setSelected({ type: "condition", id: condition.id })
      return
    }
    const firstActionId = actions[0]?.id ?? null
    const nextCondition = defaultCondition(firstActionId)
    setDraft((current) => ({ ...current, steps: [nextCondition, ...current.steps] }))
    setSelected({ type: "condition", id: nextCondition.id })
  }

  const addAction = (type: ActionType) => {
    const action = defaultAction(type)
    setDraft((current) => ({ ...current, steps: [...current.steps, action] }))
    setSelected({ type: "action", id: action.id })
  }

  const removeStep = (id: string) => {
    setDraft((current) => ({ ...current, steps: current.steps.filter((step) => step.id !== id) }))
    if (selected && "id" in selected && selected.id === id) setSelected(null)
  }

  const save = async () => {
    setSaving(true)
    setError("")
    try {
      const steps = normalizeSteps(draft.steps)
      const res = await adminApiFetch(apiBase, `/api/_flows/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name, trigger: draft.trigger, steps }),
      })
      if (!res.ok) {
        setError(messageForAdminResponse(res, "Could not save this rule."))
        return
      }
      const saved: Flow = await res.json()
      setDraft(saved)
      onSaved?.(saved)
    } catch {
      setError("Could not reach the server.")
    } finally {
      setSaving(false)
    }
  }

  const selectedStep =
    selected && "id" in selected
      ? (draft.steps.find((step) => step.id === selected.id) ?? null)
      : null

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#18181b] p-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            className="min-w-[220px] flex-1 bg-transparent text-base font-semibold text-[#fafafa] outline-none placeholder:text-[#52525b]"
            placeholder="Rule name"
          />
          <button
            type="button"
            onClick={() => setTesting(true)}
            className="rounded-lg border border-[rgba(255,255,255,0.12)] px-3 py-2 text-sm font-medium text-[#e4e4e7] transition-colors hover:bg-[rgba(255,255,255,0.05)]"
          >
            Test
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-[#fafafa] px-3 py-2 text-sm font-medium text-[#0a0a0c] transition-colors hover:bg-[#e4e4e7] disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save rule"}
          </button>
        </div>

        {error && <ErrorState compact title="Rule save failed" description={error} />}

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setSelected({ type: "trigger" })}
            className={`${sectionButtonClass(selected?.type === "trigger")} w-full`}
          >
            <div className="flex items-center gap-3">
              <span className="w-12 text-xs font-semibold text-[#71717a]">WHEN</span>
              <span className="text-sm text-[#fafafa]">{outline.when.label}</span>
            </div>
          </button>

          <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#111113] p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-12 text-xs font-semibold text-[#71717a]">IF</span>
                <span className="text-sm text-[#fafafa]">
                  {condition
                    ? `${outline.match === "any" ? "Any" : "All"} rules match`
                    : "No condition"}
                </span>
              </div>
              <button
                type="button"
                onClick={addCondition}
                className="text-xs font-medium text-[#c9956b] hover:text-[#d4a57c]"
              >
                {condition ? "Edit" : "Add condition"}
              </button>
            </div>
            {condition && (
              <div className="ml-[60px] space-y-2">
                {outline.rules.map((rule, index) => (
                  <button
                    type="button"
                    key={`${rule.field}-${index}`}
                    onClick={() => setSelected({ type: "condition", id: condition.id })}
                    className={`${sectionButtonClass(selected?.type === "condition")} w-full`}
                  >
                    <span className="text-xs text-[#a1a1aa]">
                      {rule.field || "field"} {rule.operator} {String(rule.value)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#111113] p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-12 text-xs font-semibold text-[#71717a]">DO</span>
                <span className="text-sm text-[#fafafa]">
                  {actions.length
                    ? `${actions.length} action${actions.length === 1 ? "" : "s"}`
                    : "No actions"}
                </span>
              </div>
              <select
                value=""
                onChange={(event) => {
                  if (event.target.value) addAction(event.target.value as ActionType)
                }}
                className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#18181b] px-2 py-1.5 text-xs text-[#fafafa] outline-none"
              >
                <option value="">Add action</option>
                {ACTION_TYPES.map((action) => (
                  <option key={action.type} value={action.type}>
                    {action.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="ml-[60px] space-y-2">
              {actions.map((action, index) => (
                <div key={action.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected({ type: "action", id: action.id })}
                    className={`${sectionButtonClass(selected?.type === "action" && selected.id === action.id)} min-w-0 flex-1`}
                  >
                    <span className="flex items-center gap-2 text-sm text-[#fafafa]">
                      <span className="text-xs text-[#71717a]">{index + 1}</span>
                      <span className="truncate">{actionLabel(action)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeStep(action.id)}
                    className="text-xs text-[#52525b] hover:text-[#ef4444]"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <StepConfigurator
          selectedStep={selectedStep}
          showTriggerConfig={selected?.type === "trigger"}
          trigger={draft.trigger}
          onUpdateStep={updateStep}
          onUpdateTrigger={updateTrigger}
          onClose={() => setSelected(null)}
        />
      </div>
      {testing && (
        <TestPanel
          flow={{ ...draft, steps: normalizeSteps(draft.steps) }}
          apiBase={apiBase}
          onClose={() => setTesting(false)}
        />
      )}
    </div>
  )
}
