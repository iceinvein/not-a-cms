import { useState, useEffect } from "react"
import type { Flow, FlowStep, FlowTrigger } from "./flow-types"
import { FlowCanvas } from "./FlowCanvas"
import { StepConfigurator } from "./StepConfigurator"
import { RunList } from "./RunList"

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
      const res = await fetch(`${apiBase}/api/_flows/${flowId}`)
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
      const res = await fetch(`${apiBase}/api/_flows/${flowId}`, {
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
    const res = await fetch(`${apiBase}/api/_flows/${flowId}/toggle`, { method: "POST" })
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
    return <p className="text-gray-400 text-sm">Loading flow...</p>
  }

  if (!flow) {
    return <p className="text-red-500 text-sm">Flow not found.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-4">
        <input
          type="text"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          className="flex-1 text-base font-semibold text-gray-900 border-none outline-none bg-transparent placeholder-gray-300"
          placeholder="Flow name"
        />

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggle}
            className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
              localActive
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {localActive ? "Active" : "Inactive"}
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setTab("editor")}
            className={`px-3 py-1.5 text-sm transition-colors ${
              tab === "editor"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            Editor
          </button>
          <button
            onClick={() => setTab("runs")}
            className={`px-3 py-1.5 text-sm transition-colors ${
              tab === "runs"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            Runs
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>

        {savedAt && (
          <span className="text-xs text-gray-400">Saved at {savedAt}</span>
        )}
      </div>

      {/* Main content */}
      {tab === "editor" ? (
        <div className="flex gap-4 items-start">
          {/* Canvas panel */}
          <div className="flex-1 bg-gray-50 rounded-xl border border-gray-200 min-h-[500px]" style={{ backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
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
