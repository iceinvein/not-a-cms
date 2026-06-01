import { useEffect, useMemo, useState } from "react"
import type { Horizon, HorizonItem } from "@not-a-cms/core"
import { EmptyState, ErrorState, LoadingState } from "../AdminState"
import { Icon, type IconName } from "../ui/Icon"
import { adminApiFetch, messageForAdminResponse } from "../../lib/api"
import { toNeedsYouItems, type NeedsYouItem } from "../../lib/desk/needs-you"

type Metrics = {
  collections: Array<{ name: string; label: string; inReview: number }>
}

type FlowRun = {
  id: string
  flow_id: string
  status: string
  error?: string
  started_at: string
}

type Props = {
  apiBase?: string
  userName?: string
  initialHorizon?: Horizon
  initialNeedsYou?: NeedsYouItem[]
}

const EMPTY_HORIZON: Horizon = { now: [], today: [], week: [], later: [] }

const LANES: Array<{ key: keyof Horizon; label: string; empty: string }> = [
  { key: "now", label: "Now", empty: "Nothing overdue." },
  { key: "today", label: "Today", empty: "No releases today." },
  { key: "week", label: "This week", empty: "No scheduled work this week." },
  { key: "later", label: "Later", empty: "No future releases." },
]

export function Desk({ apiBase = "", userName, initialHorizon, initialNeedsYou }: Props) {
  const [horizon, setHorizon] = useState<Horizon | null>(initialHorizon ?? null)
  const [needsYou, setNeedsYou] = useState<NeedsYouItem[] | null>(initialNeedsYou ?? null)
  const [loading, setLoading] = useState(!initialHorizon || !initialNeedsYou)
  const [error, setError] = useState("")

  async function fetchDesk() {
    setLoading(true)
    setError("")
    try {
      const [horizonRes, metricsRes, runsRes] = await Promise.all([
        initialHorizon ? Promise.resolve(null) : adminApiFetch(apiBase, "/api/_horizon"),
        initialNeedsYou ? Promise.resolve(null) : adminApiFetch(apiBase, "/api/_metrics"),
        initialNeedsYou ? Promise.resolve(null) : adminApiFetch(apiBase, "/api/_flows/runs?status=failed"),
      ])

      if (horizonRes) setHorizon(await readJson<Horizon>(horizonRes, "Failed to load publishing horizon"))
      if (metricsRes && runsRes) {
        const metrics = await readJson<Metrics>(metricsRes, "Failed to load dashboard metrics")
        const runs = await readJson<{ data: FlowRun[] }>(runsRes, "Failed to load failed automation runs")
        setNeedsYou(toNeedsYouItems(metrics, runs.data ?? []))
      }
    } catch (err: any) {
      setError(err.message || "Failed to load The Desk")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialHorizon && initialNeedsYou) return
    fetchDesk()
  }, [apiBase])

  const activeHorizon = horizon ?? EMPTY_HORIZON
  const activeNeedsYou = needsYou ?? []
  const scheduledTotal = useMemo(
    () => LANES.reduce((sum, lane) => sum + activeHorizon[lane.key].length, 0),
    [activeHorizon],
  )

  if (loading) {
    return (
      <div className="desk-stack">
        <LoadingState title="Loading The Desk" description="Collecting scheduled content and items that need attention." />
        <div className="desk-skeleton" />
      </div>
    )
  }

  if (error) {
    return (
      <ErrorState
        title="The Desk is unavailable"
        description={error}
        action={<button type="button" onClick={fetchDesk} className="desk-button">Try again</button>}
      />
    )
  }

  if (!horizon && !needsYou) {
    return <EmptyState title="Nothing to show yet" description="The Desk will fill in as content and automations are created." />
  }

  return (
    <div className="desk">
      <header className="desk-header">
        <div>
          <p className="desk-kicker">The Desk</p>
          <h2>{userName ? `${userName}'s publishing desk` : "Publishing desk"}</h2>
        </div>
        <div className="desk-summary" aria-label="Scheduled content count">
          <span>{scheduledTotal}</span>
          <small>scheduled</small>
        </div>
      </header>

      <section className="desk-main" aria-label="Editorial desk">
        <HorizonBand horizon={activeHorizon} />
        <aside className="desk-side">
          <NeedsYou items={activeNeedsYou} />
          <LiveNowStub />
        </aside>
      </section>
    </div>
  )
}

function HorizonBand({ horizon }: { horizon: Horizon }) {
  return (
    <section className="desk-panel desk-horizon" aria-labelledby="desk-horizon-title">
      <div className="desk-panel-head">
        <div>
          <p className="desk-kicker">Publishing horizon</p>
          <h3 id="desk-horizon-title">Scheduled work</h3>
        </div>
        <Icon name="calendar" size={18} className="desk-head-icon" />
      </div>
      <div className="desk-lanes">
        {LANES.map((lane) => (
          <div className="desk-lane" key={lane.key}>
            <div className="desk-lane-title">
              <span>{lane.label}</span>
              <small>{horizon[lane.key].length}</small>
            </div>
            {horizon[lane.key].length === 0 ? (
              <p className="desk-empty-line">{lane.empty}</p>
            ) : (
              <div className="desk-card-list">
                {horizon[lane.key].map((item) => (
                  <HorizonCard key={`${item.collection}:${item.documentId}`} item={item} urgency={lane.key} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function HorizonCard({ item, urgency }: { item: HorizonItem; urgency: keyof Horizon }) {
  return (
    <a className="desk-horizon-card" href={`/content/${item.collection}/${item.documentId}`}>
      <span className={`desk-status-dot desk-status-${urgency}`} aria-hidden="true" />
      <span className="desk-card-copy">
        <strong>{item.title}</strong>
        <small>{formatPublishDate(item.publishedAt)}</small>
      </span>
    </a>
  )
}

function NeedsYou({ items }: { items: NeedsYouItem[] }) {
  return (
    <section className="desk-panel desk-needs" aria-labelledby="desk-needs-title">
      <div className="desk-panel-head">
        <div>
          <p className="desk-kicker">Triage</p>
          <h3 id="desk-needs-title">Needs you</h3>
        </div>
        <span className="desk-count">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="desk-empty-line">No review queues or failed runs.</p>
      ) : (
        <div className="desk-need-list">
          {items.map((item) => (
            <NeedRow key={`${item.kind}:${item.href}`} item={item} />
          ))}
        </div>
      )}
    </section>
  )
}

function NeedRow({ item }: { item: NeedsYouItem }) {
  const icon: IconName = item.severity === "error" ? "alert" : "check"
  return (
    <a className={`desk-need-row desk-need-${item.severity}`} href={item.href}>
      <Icon name={icon} size={16} className="desk-need-icon" />
      <span className="desk-need-copy">
        <strong>{item.title}</strong>
        {item.sub ? <small>{item.sub}</small> : null}
      </span>
      <span className="desk-action">{item.action}</span>
    </a>
  )
}

function LiveNowStub() {
  return (
    <section className="desk-panel desk-live" aria-labelledby="desk-live-title">
      <div className="desk-panel-head">
        <div>
          <p className="desk-kicker">Live now</p>
          <h3 id="desk-live-title">Presence</h3>
        </div>
        <Icon name="radio" size={18} className="desk-head-icon" />
      </div>
      <p className="desk-empty-line">Live presence is coming.</p>
    </section>
  )
}

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error && res.status !== 401 && res.status !== 403
      ? data.error
      : messageForAdminResponse(res, fallback))
  }
  return data
}

function formatPublishDate(value: string | null) {
  if (!value) return "No publish date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
