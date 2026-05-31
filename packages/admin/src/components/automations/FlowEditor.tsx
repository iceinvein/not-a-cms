import { useState, useEffect } from "react"
import type { Flow, FlowStep, FlowTrigger } from "./flow-types"
import { FlowCanvas } from "./FlowCanvas"
import { StepConfigurator } from "./StepConfigurator"
import { RunList } from "./RunList"
import { ErrorState, LoadingState } from "../AdminState"
import { adminApiFetch } from "../../lib/api"

type Props = {
  flowId: string
  apiBase?: string
}

type Tab = "editor" | "runs"

export function FlowEditor({ flowId, apiBase = "" }: Props) {
  const [flow, setFlow] = useState<Flow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("editor")
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [showTriggerConfig, setShowTriggerConfig] = useState(false)
  const [localName, setLocalName] = useState("")
  const [localSteps, setLocalSteps] = useState<FlowStep[]>([])
  const [localTrigger, setLocalTrigger] = useState<FlowTrigger>({ type: "content.created" })
  const [localActive, setLocalActive] = useState(false)

  useEffect(() => {
    fetchFlow()
  }, [flowId])

  const fetchFlow = async () => {
    try {
      const res = await adminApiFetch(apiBase, `/api/_flows/${flowId}`)
      if (res.ok) {
        const data: Flow = await res.json()
        setFlow(data)
        setLocalName(data.name)
        setLocalSteps(data.steps)
        setLocalTrigger(data.trigger)
        setLocalActive(data.active)
      }
    } catch {} finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!flow) return
    setSaving(true)
    try {
      const res = await adminApiFetch(apiBase, `/api/_flows/${flowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: localName,
          steps: localSteps,
          trigger: localTrigger,
        }),
      })
      if (res.ok) {
        const updated: Flow = await res.json()
        setFlow(updated)
        setSavedAt(new Date().toLocaleTimeString())
      }
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async () => {
    if (!flow) return
    const res = await adminApiFetch(apiBase, `/api/_flows/${flowId}/toggle`, { method: "POST" })
    if (res.ok) {
      const updated: Flow = await res.json()
      setFlow(updated)
      setLocalActive(updated.active)
    }
  }

  const handleAddStep = (afterIndex: number, step: FlowStep) => {
    setLocalSteps((prev) => {
      const next = [...prev]
      next.splice(afterIndex, 0, step)
      return next
    })
    setSelectedStepId(step.id)
    setShowTriggerConfig(false)
  }

  const handleRemoveStep = (id: string) => {
    setLocalSteps((prev) => prev.filter((s) => s.id !== id))
    if (selectedStepId === id) setSelectedStepId(null)
  }

  const handleUpdateStep = (id: string, updates: Partial<FlowStep>) => {
    setLocalSteps((prev) =>
      prev.map((s) => (s.id === id ? ({ ...s, ...updates } as FlowStep) : s))
    )
  }

  const handleSelectStep = (id: string | null) => {
    setSelectedStepId(id)
    setShowTriggerConfig(false)
  }

  const handleSelectTrigger = () => {
    setSelectedStepId(null)
    setShowTriggerConfig(true)
  }

  const selectedStep = localSteps.find((s) => s.id === selectedStepId) ?? null

  if (loading) {
    return <LoadingState title="Loading flow" description="Fetching automation configuration." />
  }

  if (!flow) {
    return <ErrorState title="Flow not found" description="This automation may have been deleted or is no longer available." />
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] px-4 py-3 flex items-center gap-4">
        <input
          type="text"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          className="flex-1 text-base font-semibold text-[#fafafa] border-none outline-none bg-transparent placeholder:text-[#52525b]"
          placeholder="Flow name"
        />

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggle}
            className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
              localActive
                ? "bg-[rgba(34,197,94,0.1)] text-[#22c55e]"
                : "bg-[rgba(255,255,255,0.05)] text-[#71717a]"
            }`}
          >
            {localActive ? "Active" : "Inactive"}
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border border-[rgba(255,255,255,0.1)] rounded-lg overflow-hidden">
          <button
            onClick={() => setTab("editor")}
            className={`px-3 py-1.5 text-sm transition-colors ${
              tab === "editor"
                ? "bg-[#fafafa] text-[#0a0a0c]"
                : "text-[#71717a] hover:bg-[rgba(255,255,255,0.05)]"
            }`}
          >
            Editor
          </button>
          <button
            onClick={() => setTab("runs")}
            className={`px-3 py-1.5 text-sm transition-colors ${
              tab === "runs"
                ? "bg-[#fafafa] text-[#0a0a0c]"
                : "text-[#71717a] hover:bg-[rgba(255,255,255,0.05)]"
            }`}
          >
            Runs
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-[#fafafa] text-[#0a0a0c] rounded-lg text-sm font-medium hover:bg-[#e4e4e7] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>

        {savedAt && (
          <span className="text-xs text-[#52525b]">Saved at {savedAt}</span>
        )}
      </div>

      {/* Main content */}
      {tab === "editor" ? (
        <div className="flex gap-4 items-start">
          {/* Canvas panel */}
          <div className="flex-1 bg-[#0a0a0c] rounded-xl border border-[rgba(255,255,255,0.06)] min-h-[500px]" style={{ backgroundImage: 'radial-gradient(circle, #27272a 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            <FlowCanvas
              trigger={localTrigger}
              steps={localSteps}
              selectedStepId={selectedStepId}
              onSelectStep={handleSelectStep}
              onSelectTrigger={handleSelectTrigger}
              onAddStep={handleAddStep}
              onRemoveStep={handleRemoveStep}
            />
          </div>

          {/* Config panel */}
          <div className="w-80 flex-shrink-0">
            <StepConfigurator
              selectedStep={selectedStep}
              showTriggerConfig={showTriggerConfig}
              trigger={localTrigger}
              onUpdateStep={handleUpdateStep}
              onUpdateTrigger={setLocalTrigger}
              onClose={() => {
                setSelectedStepId(null)
                setShowTriggerConfig(false)
              }}
            />
          </div>
        </div>
      ) : (
        <RunList flowId={flowId} apiBase={apiBase} steps={localSteps} />
      )}
    </div>
  )
}
