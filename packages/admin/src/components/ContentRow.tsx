import type { PageviewSummary } from "@not-a-cms/core"
import { freshnessIntensity, isDormant } from "../lib/pulse/freshness"
import { scheduledAt, statusToSignal } from "../lib/pulse/list"
import type { SpinePerson } from "../lib/pulse/presence"
import { PresenceDots } from "./pulse/PresenceDots"
import { Sparkline } from "./pulse/Sparkline"
import { StatusSignal } from "./pulse/StatusSignal"

type ContentItem = {
  id: string
  title?: string
  status?: string
  updated_at?: string
  [key: string]: unknown
}

export function ContentRow({
  collection,
  item,
  presence,
  views,
  now,
  selected,
  onToggleSelect,
  onDelete,
}: {
  collection: string
  item: ContentItem
  presence: SpinePerson[]
  views: PageviewSummary | null
  now: number
  selected: boolean
  onToggleSelect: (id: string, checked: boolean) => void
  onDelete: (id: string, title: string) => void
}) {
  const label = String(item.title || item.id)
  const intensity = freshnessIntensity(item.updated_at ?? "", now)
  const fresh = intensity > 0.05
  const dormant = isDormant(item.updated_at ?? "", now)
  const published = item.status === "published"

  return (
    <tr className={`pulse-list-row${dormant ? " pulse-dormant" : ""} hover:bg-[rgba(255,255,255,0.02)] transition-colors`}>
      <td
        className={`px-4 py-4 pulse-row${fresh ? " pulse-fresh" : ""}`}
        style={{ ["--pulse-freshness" as never]: intensity.toFixed(3) }}
      >
        <input
          type="checkbox"
          aria-label={`Select ${label}`}
          checked={selected}
          onChange={(event) => onToggleSelect(item.id, event.target.checked)}
        />
      </td>
      <td className="px-6 py-4">
        <span className="pulse-list-title">
          <a
            href={`/content/${collection}/${item.id}`}
            className="text-sm font-medium text-[#fafafa] hover:text-[#c6ff3d] transition-colors"
          >
            {label}
          </a>
          {presence.length > 0 ? <PresenceDots people={presence} max={3} /> : null}
        </span>
      </td>
      <td className="px-6 py-4">
        <StatusSignal kind={statusToSignal(item.status)} at={scheduledAt(item)} now={now} />
      </td>
      <td className="px-6 py-4">
        {published && views && views.total > 0 ? (
          <Sparkline points={views.series} delta={`+${views.today} today`} />
        ) : (
          <span className="pulse-list-empty">&mdash;</span>
        )}
      </td>
      <td className="px-6 py-4 text-sm text-[#838389]">{formatDate(item.updated_at)}</td>
      <td className="px-6 py-4 text-right">
        <a
          href={`/content/${collection}/${item.id}`}
          className="text-sm text-[#909099] hover:text-[#c6ff3d] mr-3 transition-colors"
        >
          Edit
        </a>
        <button
          type="button"
          onClick={() => onDelete(item.id, label)}
          className="text-sm text-[#ef4444] hover:text-[#f87171] transition-colors"
        >
          Delete
        </button>
      </td>
    </tr>
  )
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value) return ""
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) return ""
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}
