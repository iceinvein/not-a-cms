import { useState } from "react"
import { adminApiFetch, messageForAdminResponse } from "../../lib/api"
import { defaultPayloadForTrigger, documentToPayload } from "../../lib/automations/test-payload"
import { ErrorState } from "../AdminState"
import type { DryRunResult, Flow, FlowTrigger } from "./flow-types"
import { RunInspector } from "./RunInspector"

type Props = {
  flow: Flow
  apiBase?: string
  onClose: () => void
}

function contentCollection(trigger: FlowTrigger): string | null {
  if (trigger.type.startsWith("content.") && "collection" in trigger && trigger.collection)
    return trigger.collection
  return null
}

export function TestPanel({ flow, apiBase = "", onClose }: Props) {
  const [payloadText, setPayloadText] = useState(() =>
    JSON.stringify(defaultPayloadForTrigger(flow.trigger), null, 2),
  )
  const [result, setResult] = useState<DryRunResult | null>(null)
  const [error, setError] = useState("")
  const [running, setRunning] = useState(false)

  const collection = contentCollection(flow.trigger)
  const isSaved = Boolean(flow.id) && flow.created_at !== ""

  const loadRecentDocument = async () => {
    setError("")
    if (!collection) return
    try {
      const res = await adminApiFetch(apiBase, `/api/${collection}?limit=5`)
      if (!res.ok) {
        setError(messageForAdminResponse(res, "Could not load documents."))
        return
      }
      const body = await res.json()
      const doc = (body.data || [])[0]
      if (!doc) {
        setError("No documents found in this collection.")
        return
      }
      setPayloadText(JSON.stringify(documentToPayload(flow.trigger, doc), null, 2))
    } catch {
      setError("Could not reach the server.")
    }
  }

  const loadPastRun = async () => {
    setError("")
    try {
      const res = await adminApiFetch(apiBase, `/api/_flows/${flow.id}/runs?limit=10`)
      if (!res.ok) {
        setError(messageForAdminResponse(res, "Could not load runs."))
        return
      }
      const body = await res.json()
      const run = (body.data || [])[0]
      if (!run?.trigger_payload) {
        setError("No past runs with a payload.")
        return
      }
      const parsed = JSON.parse(run.trigger_payload)
      setPayloadText(JSON.stringify(parsed, null, 2))
    } catch {
      setError("Could not reach the server.")
    }
  }

  const runTest = async () => {
    setError("")
    setResult(null)
    let payload: unknown
    try {
      payload = JSON.parse(payloadText)
    } catch {
      setError("Payload is not valid JSON.")
      return
    }
    setRunning(true)
    try {
      const res = await adminApiFetch(apiBase, "/api/_flows/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow, payload }),
      })
      if (!res.ok) {
        setError(messageForAdminResponse(res, "Dry-run failed."))
        return
      }
      setResult(await res.json())
    } catch {
      setError("Could not reach the server.")
    } finally {
      setRunning(false)
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: click-to-dismiss backdrop; the equivalent keyboard path is the focusable Close button inside the dialog, and role="presentation" keeps the overlay out of the a11y tree.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.6)] p-4"
      onClick={onClose}
      role="presentation"
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: handler only stopPropagation so clicks inside the dialog do not reach the backdrop; it is not an activatable control. */}
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0a0a0c] p-5"
        role="dialog"
        aria-modal="true"
        aria-label="Test rule"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-[#fafafa]">Test rule</p>
            <p className="text-xs text-[#71717a]">
              Simulated: no webhooks, emails, or content writes are performed.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-[#71717a] hover:text-[#fafafa]"
          >
            Close
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {collection && (
            <button
              type="button"
              onClick={loadRecentDocument}
              className="rounded-lg border border-[rgba(255,255,255,0.12)] px-3 py-1.5 text-xs text-[#e4e4e7] hover:bg-[rgba(255,255,255,0.05)]"
            >
              Load recent document
            </button>
          )}
          {isSaved && (
            <button
              type="button"
              onClick={loadPastRun}
              className="rounded-lg border border-[rgba(255,255,255,0.12)] px-3 py-1.5 text-xs text-[#e4e4e7] hover:bg-[rgba(255,255,255,0.05)]"
            >
              Load from past run
            </button>
          )}
        </div>

        <label htmlFor="dry-run-payload" className="mb-1 block text-xs font-medium text-[#a1a1aa]">
          Test payload (JSON)
        </label>
        <textarea
          id="dry-run-payload"
          value={payloadText}
          onChange={(event) => setPayloadText(event.target.value)}
          spellCheck={false}
          className="mb-3 h-40 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#111113] p-3 font-mono text-xs text-[#e4e4e7] outline-none"
        />

        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={runTest}
            disabled={running}
            className="rounded-lg bg-[#c9956b] px-3 py-2 text-sm font-medium text-[#0a0a0c] transition-colors hover:bg-[#d4a57c] disabled:opacity-50"
          >
            {running ? "Running..." : "Run test"}
          </button>
        </div>

        {error && <ErrorState compact title="Test failed" description={error} />}
        {result && <RunInspector run={result} />}
      </div>
    </div>
  )
}
