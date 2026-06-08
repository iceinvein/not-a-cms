import type { Horizon, HorizonItem } from "@not-a-cms/core"
import { useEffect, useMemo, useState } from "react"
import { adminApiFetch, messageForAdminResponse } from "../../lib/api"
import { type LiveRow, type PresenceRoomView, toLiveRows } from "../../lib/desk/live"
import { type ExpiringItem, type NeedsYouItem, toNeedsYouItems } from "../../lib/desk/needs-you"
import { EmptyState, ErrorState, LoadingState } from "../AdminState"
import { Icon, type IconName } from "../ui/Icon"

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
  initialExpiring?: ExpiringItem[]
  initialLive?: LiveRow[]
}

const EMPTY_HORIZON: Horizon = { now: [], today: [], week: [], later: [] }

const LANES: Array<{ key: keyof Horizon; label: string; empty: string }> = [
  { key: "now", label: "Now", empty: "Nothing overdue." },
  { key: "today", label: "Today", empty: "No releases today." },
  { key: "week", label: "This week", empty: "No scheduled work this week." },
  { key: "later", label: "Later", empty: "No future releases." },
]

export function Desk({
  apiBase = "",
  userName,
  initialHorizon,
  initialNeedsYou,
  initialExpiring,
  initialLive,
}: Props) {
  const [horizon, setHorizon] = useState<Horizon | null>(initialHorizon ?? null)
  const [needsYou, setNeedsYou] = useState<NeedsYouItem[] | null>(initialNeedsYou ?? null)
  const [live, setLive] = useState<LiveRow[]>(initialLive ?? [])
  const [loading, setLoading] = useState(!initialHorizon || !initialNeedsYou)
  const [error, setError] = useState("")

  async function fetchDesk() {
    setLoading(true)
    setError("")

    // Each source loads independently and degrades to empty on failure, so a
    // single endpoint a given role cannot access (e.g. admin-only failed-runs)
    // never collapses the whole Desk. Only a total auth failure shows the error.
    const [horizonResult, metricsResult, runsResult, expiringResult] = await Promise.all([
      initialHorizon ? ok<Horizon | null>(null) : tryJson<Horizon>(apiBase, "/api/_horizon"),
      initialNeedsYou ? ok<Metrics | null>(null) : tryJson<Metrics>(apiBase, "/api/_metrics"),
      initialNeedsYou
        ? ok<{ data: FlowRun[] } | null>(null)
        : tryJson<{ data: FlowRun[] }>(apiBase, "/api/_flows/runs?status=failed"),
      initialNeedsYou || initialExpiring
        ? ok<{ items: ExpiringItem[] } | null>(null)
        : tryJson<{ items: ExpiringItem[] }>(apiBase, "/api/_expiring"),
    ])

    if (!initialHorizon && horizonResult.ok) setHorizon(horizonResult.data ?? EMPTY_HORIZON)
    else if (!initialHorizon && !horizonResult.ok) setHorizon(EMPTY_HORIZON)

    if (!initialNeedsYou) {
      const metrics = metricsResult.ok
        ? (metricsResult.data ?? { collections: [] })
        : { collections: [] }
      const runs = runsResult.ok ? (runsResult.data?.data ?? []) : [] // admin-only; tolerate 403
      const expiring = expiringResult.ok
        ? (expiringResult.data?.items ?? [])
        : (initialExpiring ?? [])
      setNeedsYou(toNeedsYouItems(metrics, runs, expiring))
    }

    // Treat the Desk as unavailable only when the core read endpoints both fail
    // (e.g. the session is not authenticated at all), not when one widget 403s.
    const coreUnavailable =
      !initialHorizon && !horizonResult.ok && !initialNeedsYou && !metricsResult.ok
    setError(coreUnavailable ? "Sign in to view The Desk." : "")
    setLoading(false)
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchDesk is recreated each render and the initial* props are one-time SSR guards; this should refetch only when apiBase changes, not on every render.
  useEffect(() => {
    if (initialHorizon && initialNeedsYou) return
    fetchDesk()
  }, [apiBase])

  useEffect(() => {
    if (initialLive) return
    let cancelled = false

    async function fetchPresence() {
      if (typeof document !== "undefined" && document.hidden) return
      try {
        const res = await adminApiFetch(apiBase, "/api/_presence")
        const body = await readJson<{ rooms: PresenceRoomView[] }>(
          res,
          "Failed to load live presence",
        )
        if (!cancelled) setLive(toLiveRows(body.rooms ?? []))
      } catch {
        if (!cancelled) setLive([])
      }
    }

    fetchPresence()
    const interval = window.setInterval(fetchPresence, 8_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [apiBase, initialLive])

  const activeHorizon = horizon ?? EMPTY_HORIZON
  const activeNeedsYou = needsYou ?? []
  const scheduledTotal = useMemo(
    () => LANES.reduce((sum, lane) => sum + activeHorizon[lane.key].length, 0),
    [activeHorizon],
  )

  if (loading) {
    return (
      <div className="desk-stack">
        <LoadingState
          title="Loading The Desk"
          description="Collecting scheduled content and items that need attention."
        />
        <div className="desk-skeleton" />
      </div>
    )
  }

  if (error) {
    return (
      <ErrorState
        title="The Desk is unavailable"
        description={error}
        action={
          <button type="button" onClick={fetchDesk} className="desk-button">
            Try again
          </button>
        }
      />
    )
  }

  if (!horizon && !needsYou) {
    return (
      <EmptyState
        title="Nothing to show yet"
        description="The Desk will fill in as content and automations are created."
      />
    )
  }

  return (
    <div className="desk">
      <header className="desk-header">
        <div>
          <p className="desk-kicker">The Desk</p>
          <h2>{userName ? `${userName}'s publishing desk` : "Publishing desk"}</h2>
        </div>
        {/* biome-ignore lint/a11y/useSemanticElements: this groups a stat readout (count + unit) under one label, not form controls; a <fieldset> would carry UA-default styling and the wrong semantics. */}
        <div className="desk-summary" role="group" aria-label="Scheduled content count">
          <span>{scheduledTotal}</span>
          <small>scheduled</small>
        </div>
      </header>

      <section className="desk-main" aria-label="Editorial desk">
        <HorizonBand horizon={activeHorizon} />
        <aside className="desk-side">
          <NeedsYou items={activeNeedsYou} />
          <LiveNow rows={live} />
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
                  <HorizonCard
                    key={`${item.collection}:${item.documentId}`}
                    item={item}
                    urgency={lane.key}
                  />
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
  const icon: IconName =
    item.kind === "expiring" ? "calendar" : item.severity === "error" ? "alert" : "check"
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

function LiveNow({ rows }: { rows: LiveRow[] }) {
  return (
    <section className="desk-panel desk-live" aria-labelledby="desk-live-title">
      <div className="desk-panel-head">
        <div>
          <p className="desk-kicker">Live now</p>
          <h3 id="desk-live-title">Presence</h3>
        </div>
        <Icon name="radio" size={18} className="desk-head-icon" />
      </div>
      {rows.length === 0 ? (
        <p className="desk-empty-line">No one else is editing right now.</p>
      ) : (
        <div className="desk-need-list">
          {rows.map((row) => (
            <LiveRowLink key={`${row.collection}:${row.documentId}:${row.name}`} row={row} />
          ))}
        </div>
      )}
    </section>
  )
}

function LiveRowLink({ row }: { row: LiveRow }) {
  return (
    <a className="desk-need-row" href={row.href}>
      <span
        aria-hidden="true"
        style={{
          background: row.color,
          borderRadius: "999px",
          flex: "none",
          height: 10,
          width: 10,
        }}
      />
      <span className="desk-need-copy">
        <strong>{row.name} editing</strong>
        <small>{row.title}</small>
      </span>
      <span className="desk-action">{row.collection}</span>
    </a>
  )
}

type Result<T> = { ok: true; data: T | null } | { ok: false; data?: undefined }

function ok<T>(data: T): Promise<Result<T>> {
  return Promise.resolve({ ok: true, data })
}

async function tryJson<T>(apiBase: string, path: string): Promise<Result<T>> {
  try {
    const res = await adminApiFetch(apiBase, path)
    if (!res.ok) return { ok: false }
    return { ok: true, data: (await res.json()) as T }
  } catch {
    return { ok: false }
  }
}

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  const data = await res.json()
  if (!res.ok) {
    throw new Error(
      data.error && res.status !== 401 && res.status !== 403
        ? data.error
        : messageForAdminResponse(res, fallback),
    )
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
