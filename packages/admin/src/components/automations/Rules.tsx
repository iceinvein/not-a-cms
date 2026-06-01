import { useEffect, useState } from "react"
import type { Flow } from "./flow-types"
import { flowToReadable, type RuleToken } from "../../lib/automations/readable"
import { adminApiFetch, messageForAdminResponse } from "../../lib/api"
import { EmptyState, ErrorState, LoadingState } from "../AdminState"
import { RuleEditor } from "./RuleEditor"

type Props = {
  apiBase?: string
  initialFlows?: Flow[]
  initialSelectedId?: string
}

function tokenClass(kind: RuleToken["kind"]): string {
  switch (kind) {
    case "trigger":
      return "rounded-full bg-[rgba(201,149,107,0.14)] px-2 py-0.5 font-medium text-[#d4a57c]"
    case "entity":
      return "font-semibold text-[#fafafa]"
    case "condition":
      return "rounded-full border border-[rgba(245,158,11,0.28)] px-2 py-0.5 text-[#f59e0b]"
    case "action":
      return "rounded-full border border-[rgba(255,255,255,0.12)] px-2 py-0.5 text-[#e4e4e7]"
    default:
      return "text-[#a1a1aa]"
  }
}

function statusDot(active: boolean): string {
  return `inline-block h-2 w-2 rounded-full ${active ? "bg-[#22c55e]" : "bg-[#52525b]"}`
}

export function Rules({ apiBase = "", initialFlows, initialSelectedId }: Props) {
  const [flows, setFlows] = useState<Flow[]>(initialFlows ?? [])
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? initialFlows?.[0]?.id ?? null)
  const [loading, setLoading] = useState(!initialFlows)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")

  const fetchFlows = async () => {
    setError("")
    try {
      const res = await adminApiFetch(apiBase, "/api/_flows")
      if (!res.ok) {
        setError(messageForAdminResponse(res, "Could not load rules."))
        return
      }
      const data = await res.json()
      const nextFlows = data.data || []
      setFlows(nextFlows)
      setSelectedId((current) => current ?? nextFlows[0]?.id ?? null)
    } catch {
      setError("Could not reach the server.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!initialFlows) fetchFlows()
  }, [apiBase])

  const createRule = async () => {
    setCreating(true)
    setError("")
    try {
      const res = await adminApiFetch(apiBase, "/api/_flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Untitled rule",
          trigger: { type: "content.created" },
          steps: [],
          active: false,
        }),
      })
      if (!res.ok) {
        setError(messageForAdminResponse(res, "Could not create a rule."))
        return
      }
      const flow: Flow = await res.json()
      setFlows((current) => [flow, ...current])
      setSelectedId(flow.id)
    } catch {
      setError("Could not reach the server.")
    } finally {
      setCreating(false)
    }
  }

  const handleSaved = (flow: Flow) => {
    setFlows((current) => current.map((item) => (item.id === flow.id ? flow : item)))
  }

  if (loading) return <LoadingState title="Loading rules" description="Fetching automation definitions." />

  const selectedFlow = flows.find((flow) => flow.id === selectedId) ?? null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[#a1a1aa]">Readable WHEN, IF, DO rules backed by automation flows.</p>
        </div>
        <button
          type="button"
          onClick={createRule}
          disabled={creating}
          className="rounded-lg bg-[#c9956b] px-3 py-2 text-sm font-medium text-[#0a0a0c] transition-colors hover:bg-[#d4a57c] disabled:opacity-50"
        >
          {creating ? "Creating..." : "+ New rule"}
        </button>
      </div>

      {error && (
        <ErrorState
          title="Rules unavailable"
          description={error}
          action={<button type="button" onClick={fetchFlows} className="rounded-md bg-[rgba(255,255,255,0.08)] px-3 py-1.5 text-sm font-medium text-[#fafafa] transition-colors hover:bg-[rgba(255,255,255,0.12)]">Try again</button>}
        />
      )}

      {flows.length === 0 ? (
        <EmptyState title="No rules yet" description="Create a rule to run actions when content changes, a webhook arrives, or a schedule fires." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#18181b]">
            {flows.map((flow) => {
              const tokens = flowToReadable(flow)
              const selected = flow.id === selectedFlow?.id
              return (
                <button
                  key={flow.id}
                  type="button"
                  onClick={() => setSelectedId(flow.id)}
                  className={`block w-full border-b border-[rgba(255,255,255,0.06)] p-4 text-left transition-colors last:border-b-0 ${
                    selected ? "bg-[rgba(255,255,255,0.05)]" : "hover:bg-[rgba(255,255,255,0.03)]"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-[#fafafa]">{flow.name}</span>
                    <span className="flex items-center gap-2 text-xs text-[#71717a]">
                      <span className={statusDot(flow.active)} />
                      {flow.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="flex flex-wrap items-center gap-1.5 text-sm leading-7">
                    {tokens.map((token, index) => (
                      <span key={`${token.kind}-${index}`} className={tokenClass(token.kind)}>
                        {token.text}
                      </span>
                    ))}
                  </p>
                </button>
              )
            })}
          </div>

          <div>
            {selectedFlow ? (
              <RuleEditor flow={selectedFlow} apiBase={apiBase} onSaved={handleSaved} />
            ) : (
              <EmptyState title="Select a rule" description="Choose a rule to inspect or edit its WHEN, IF, DO outline." />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
