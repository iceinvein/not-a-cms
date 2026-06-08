import { useState } from "react"
import { Console } from "./Console"
import { Rules } from "./Rules"

type Props = {
  apiBase?: string
  flowId: string
  initialRunId?: string
}

type Tab = "rule" | "console"

function tabClass(active: boolean): string {
  return `px-3 py-1.5 text-sm transition-colors ${
    active ? "bg-[#fafafa] text-[#0a0a0c]" : "text-[#71717a] hover:bg-[rgba(255,255,255,0.05)]"
  }`
}

export function AutomationWorkspace({ apiBase = "", flowId, initialRunId }: Props) {
  const [tab, setTab] = useState<Tab>(initialRunId ? "console" : "rule")

  return (
    <div className="space-y-4">
      <div className="flex border border-[rgba(255,255,255,0.1)] rounded-lg overflow-hidden w-fit">
        <button type="button" onClick={() => setTab("rule")} className={tabClass(tab === "rule")}>
          Rule
        </button>
        <button
          type="button"
          onClick={() => setTab("console")}
          className={tabClass(tab === "console")}
        >
          Console
        </button>
      </div>

      {tab === "rule" ? (
        <Rules apiBase={apiBase} initialSelectedId={flowId} />
      ) : (
        <Console apiBase={apiBase} flowId={flowId} initialSelectedRunId={initialRunId} />
      )}
    </div>
  )
}
