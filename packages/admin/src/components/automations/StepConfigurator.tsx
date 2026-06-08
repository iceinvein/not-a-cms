import { useState } from "react"
import type {
  ActionStep,
  ConditionOperator,
  ConditionRule,
  ConditionStep,
  FlowStep,
  FlowTrigger,
} from "./flow-types"

type Props = {
  selectedStep: FlowStep | null
  showTriggerConfig: boolean
  trigger: FlowTrigger
  onUpdateStep: (id: string, updates: Partial<FlowStep>) => void
  onUpdateTrigger: (trigger: FlowTrigger) => void
  onClose: () => void
}

const inputClass =
  "w-full border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm bg-[#18181b] text-[#fafafa] placeholder:text-[#52525b] focus:border-[rgba(255,255,255,0.2)] focus:outline-none focus:ring-0"
const labelClass = "block text-xs font-medium text-[#a1a1aa] mb-1"
const sectionClass = "flex flex-col gap-3"

const CRON_PRESETS = [
  { label: "Every minute", value: "*/1 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every day at midnight", value: "0 0 * * *" },
  { label: "Every Monday at 9am", value: "0 9 * * 1" },
]

const TRIGGER_TYPES: { value: FlowTrigger["type"]; label: string }[] = [
  { value: "content.created", label: "Content Created" },
  { value: "content.updated", label: "Content Updated" },
  { value: "content.published", label: "Content Published" },
  { value: "content.deleted", label: "Content Deleted" },
  { value: "webhook.received", label: "Webhook Received" },
  { value: "schedule.cron", label: "Scheduled (Cron)" },
]

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "matches", label: "matches regex" },
]

function isContentTrigger(type: FlowTrigger["type"]): boolean {
  return ["content.created", "content.updated", "content.published", "content.deleted"].includes(
    type,
  )
}

function TriggerConfig({
  trigger,
  onUpdateTrigger,
}: {
  trigger: FlowTrigger
  onUpdateTrigger: (trigger: FlowTrigger) => void
}) {
  const handleTypeChange = (type: FlowTrigger["type"]) => {
    if (type === "schedule.cron") {
      onUpdateTrigger({ type: "schedule.cron", cron: "0 * * * *" })
    } else if (type === "webhook.received") {
      onUpdateTrigger({ type: "webhook.received" })
    } else {
      const collection = "collection" in trigger ? trigger.collection : undefined
      onUpdateTrigger({ type: type as "content.created", collection })
    }
  }

  const collection = "collection" in trigger ? (trigger.collection ?? "") : ""
  const cron = trigger.type === "schedule.cron" ? trigger.cron : ""

  return (
    <div className={sectionClass}>
      <div>
        <label className={labelClass}>Trigger type</label>
        <select
          value={trigger.type}
          onChange={(e) => handleTypeChange(e.target.value as FlowTrigger["type"])}
          className={inputClass}
        >
          {TRIGGER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {isContentTrigger(trigger.type) && (
        <div>
          <label className={labelClass}>Collection (optional)</label>
          <input
            type="text"
            value={collection}
            onChange={(e) =>
              onUpdateTrigger({ ...trigger, collection: e.target.value } as FlowTrigger)
            }
            placeholder="e.g. posts"
            className={inputClass}
          />
        </div>
      )}

      {trigger.type === "schedule.cron" && (
        <div>
          <label className={labelClass}>Cron expression</label>
          <input
            type="text"
            value={cron}
            onChange={(e) => onUpdateTrigger({ type: "schedule.cron", cron: e.target.value })}
            placeholder="0 * * * *"
            className={inputClass}
          />
          <div className="flex flex-wrap gap-1 mt-2">
            {CRON_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => onUpdateTrigger({ type: "schedule.cron", cron: preset.value })}
                className="text-xs px-2 py-1 rounded bg-[rgba(255,255,255,0.05)] text-[#71717a] hover:bg-[rgba(255,255,255,0.08)] transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ConditionConfig({
  step,
  onUpdateStep,
}: {
  step: ConditionStep
  onUpdateStep: (id: string, updates: Partial<FlowStep>) => void
}) {
  const updateRule = (index: number, updates: Partial<ConditionRule>) => {
    const rules = step.rules.map((r, i) => (i === index ? { ...r, ...updates } : r))
    onUpdateStep(step.id, { rules } as Partial<ConditionStep>)
  }

  const addRule = () => {
    const rules: ConditionRule[] = [...step.rules, { field: "", operator: "eq", value: "" }]
    onUpdateStep(step.id, { rules } as Partial<ConditionStep>)
  }

  const removeRule = (index: number) => {
    const rules = step.rules.filter((_, i) => i !== index)
    onUpdateStep(step.id, { rules } as Partial<ConditionStep>)
  }

  return (
    <div className={sectionClass}>
      <div>
        <label className={labelClass}>Match mode</label>
        <select
          value={step.match}
          onChange={(e) =>
            onUpdateStep(step.id, {
              match: e.target.value as "all" | "any",
            } as Partial<ConditionStep>)
          }
          className={inputClass}
        >
          <option value="all">All rules (AND)</option>
          <option value="any">Any rule (OR)</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <p className={labelClass}>Rules</p>
        {step.rules.length === 0 && (
          <p className="text-xs text-[#52525b] italic">No rules yet. Add one below.</p>
        )}
        {step.rules.map((rule, i) => (
          <div
            key={i}
            className="bg-[rgba(255,255,255,0.05)] rounded-lg border border-[rgba(255,255,255,0.06)] p-2 flex flex-col gap-2"
          >
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={rule.field}
                onChange={(e) => updateRule(i, { field: e.target.value })}
                placeholder="Field path"
                className="flex-1 border border-[rgba(255,255,255,0.1)] rounded px-2 py-1 text-xs bg-[#18181b] text-[#fafafa] placeholder:text-[#52525b] focus:outline-none focus:border-[rgba(255,255,255,0.2)]"
              />
              <button
                onClick={() => removeRule(i)}
                className="text-[#52525b] hover:text-[#ef4444] text-xs"
              >
                Remove
              </button>
            </div>
            <select
              value={rule.operator}
              onChange={(e) => updateRule(i, { operator: e.target.value as ConditionOperator })}
              className="border border-[rgba(255,255,255,0.1)] rounded px-2 py-1 text-xs bg-[#18181b] text-[#fafafa] focus:outline-none focus:border-[rgba(255,255,255,0.2)]"
            >
              {OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={String(rule.value)}
              onChange={(e) => updateRule(i, { value: e.target.value })}
              placeholder="Value"
              className="border border-[rgba(255,255,255,0.1)] rounded px-2 py-1 text-xs bg-[#18181b] text-[#fafafa] placeholder:text-[#52525b] focus:outline-none focus:border-[rgba(255,255,255,0.2)]"
            />
          </div>
        ))}
        <button
          onClick={addRule}
          className="text-xs text-[#a1a1aa] hover:text-[#fafafa] self-start mt-1"
        >
          + Add rule
        </button>
      </div>
    </div>
  )
}

function ActionConfig({
  step,
  onUpdateStep,
}: {
  step: ActionStep
  onUpdateStep: (id: string, updates: Partial<FlowStep>) => void
}) {
  const [jsonErrors, setJsonErrors] = useState<Record<string, boolean>>({})

  const setConfig = (key: string, value: unknown) => {
    onUpdateStep(step.id, { config: { ...step.config, [key]: value } } as Partial<ActionStep>)
  }

  const setLabel = (label: string) => {
    onUpdateStep(step.id, { label } as Partial<ActionStep>)
  }

  const handleJsonField = (key: string, raw: string) => {
    try {
      const parsed = JSON.parse(raw)
      setConfig(key, parsed)
      setJsonErrors((prev) => ({ ...prev, [key]: false }))
    } catch {
      setJsonErrors((prev) => ({ ...prev, [key]: true }))
    }
  }

  const cfg = step.config

  return (
    <div className={sectionClass}>
      <div>
        <label className={labelClass}>Label (optional)</label>
        <input
          type="text"
          value={step.label ?? ""}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Step label"
          className={inputClass}
        />
      </div>

      {step.type === "action.webhook" && (
        <>
          <div>
            <label className={labelClass}>URL</label>
            <input
              type="url"
              value={(cfg.url as string) ?? ""}
              onChange={(e) => setConfig("url", e.target.value)}
              placeholder="https://example.com/hook"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Method</label>
            <select
              value={(cfg.method as string) ?? "POST"}
              onChange={(e) => setConfig("method", e.target.value)}
              className={inputClass}
            >
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>
        </>
      )}

      {step.type === "action.email" && (
        <>
          <div>
            <label className={labelClass}>To</label>
            <input
              type="email"
              value={(cfg.to as string) ?? ""}
              onChange={(e) => setConfig("to", e.target.value)}
              placeholder="recipient@example.com"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Subject</label>
            <input
              type="text"
              value={(cfg.subject as string) ?? ""}
              onChange={(e) => setConfig("subject", e.target.value)}
              placeholder="Email subject"
              className={inputClass}
            />
          </div>
        </>
      )}

      {(step.type === "action.create_content" || step.type === "action.update_content") && (
        <>
          <div>
            <label className={labelClass}>Collection</label>
            <input
              type="text"
              value={(cfg.collection as string) ?? ""}
              onChange={(e) => setConfig("collection", e.target.value)}
              placeholder="e.g. posts"
              className={inputClass}
            />
          </div>
          {step.type === "action.update_content" && (
            <div>
              <label className={labelClass}>Document ID</label>
              <input
                type="text"
                value={(cfg.documentId as string) ?? (cfg.document_id as string) ?? ""}
                onChange={(e) => setConfig("documentId", e.target.value)}
                placeholder="{{payload.id}}"
                className={inputClass}
              />
            </div>
          )}
          <div>
            <label className={labelClass}>Data mapping (JSON)</label>
            <textarea
              rows={4}
              defaultValue={cfg.data ? JSON.stringify(cfg.data, null, 2) : ""}
              onChange={(e) => handleJsonField("data", e.target.value)}
              placeholder='{"title": "{{payload.title}}"}'
              className={`${inputClass} font-mono ${jsonErrors["data"] ? "border-red-400" : ""}`}
            />
            {jsonErrors["data"] && <p className="text-xs text-red-500 mt-1">Invalid JSON</p>}
          </div>
        </>
      )}

      {step.type === "action.delete_content" && (
        <>
          <div>
            <label className={labelClass}>Collection</label>
            <input
              type="text"
              value={(cfg.collection as string) ?? ""}
              onChange={(e) => setConfig("collection", e.target.value)}
              placeholder="e.g. posts"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Document ID</label>
            <input
              type="text"
              value={(cfg.documentId as string) ?? (cfg.document_id as string) ?? ""}
              onChange={(e) => setConfig("documentId", e.target.value)}
              placeholder="{{payload.id}}"
              className={inputClass}
            />
          </div>
        </>
      )}

      {step.type === "action.log" && (
        <div>
          <label className={labelClass}>Message</label>
          <textarea
            rows={3}
            value={(cfg.message as string) ?? ""}
            onChange={(e) => setConfig("message", e.target.value)}
            placeholder="Log message"
            className={inputClass}
          />
        </div>
      )}

      {step.type === "action.transform" && (
        <div>
          <label className={labelClass}>Mappings (JSON)</label>
          <textarea
            rows={5}
            defaultValue={cfg.mappings ? JSON.stringify(cfg.mappings, null, 2) : ""}
            onChange={(e) => handleJsonField("mappings", e.target.value)}
            placeholder='{"output.field": "{{payload.source}}"}'
            className={`${inputClass} font-mono ${jsonErrors["mappings"] ? "border-red-400" : ""}`}
          />
          {jsonErrors["mappings"] && <p className="text-xs text-red-500 mt-1">Invalid JSON</p>}
        </div>
      )}

      <p className="text-xs text-[#52525b] italic">
        Use {"{{payload.field.path}}"} to reference trigger data.
      </p>
    </div>
  )
}

export function StepConfigurator({
  selectedStep,
  showTriggerConfig,
  trigger,
  onUpdateStep,
  onUpdateTrigger,
  onClose,
}: Props) {
  const title = showTriggerConfig
    ? "Trigger"
    : selectedStep?.type === "condition"
      ? "Condition"
      : selectedStep
        ? "Action"
        : null

  const panelAccent = showTriggerConfig
    ? "ring-1 ring-[rgba(255,255,255,0.16)]"
    : selectedStep?.type === "condition"
      ? "ring-1 ring-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.03)]"
      : selectedStep
        ? "ring-1 ring-[rgba(255,255,255,0.1)]"
        : ""

  return (
    <div
      className={`bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] p-4 ${panelAccent}`}
    >
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#fafafa]">{title}</h3>
          <button onClick={onClose} className="text-[#52525b] hover:text-[#a1a1aa] text-sm">
            ✕
          </button>
        </div>
      )}

      {showTriggerConfig ? (
        <TriggerConfig trigger={trigger} onUpdateTrigger={onUpdateTrigger} />
      ) : selectedStep?.type === "condition" ? (
        <ConditionConfig step={selectedStep} onUpdateStep={onUpdateStep} />
      ) : selectedStep ? (
        <ActionConfig step={selectedStep as ActionStep} onUpdateStep={onUpdateStep} />
      ) : (
        <p className="text-sm text-[#52525b] text-center py-4">
          Select a step to configure it, or click the trigger to change it.
        </p>
      )}
    </div>
  )
}
