import { Clock3, FileText, Image, PenLine } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { adminApiFetch, messageForAdminResponse } from "../lib/api"
import { EmptyState, ErrorState, LoadingState } from "./AdminState"

export type DashboardCollectionMetric = {
  name: string
  label: string
  total: number
  drafts: number
  inReview: number
  published: number
  scheduled: number
}

export type DashboardAuditEvent = {
  id: string
  action: string
  summary: string | null
  collection: string | null
  documentId: string | null
  createdAt: string
}

export type DashboardMetrics = {
  collections: DashboardCollectionMetric[]
  media: { total: number }
  recentAudit: DashboardAuditEvent[]
  totals?: {
    content: number
    drafts: number
    inReview: number
    published: number
    scheduled: number
  }
}

type Props = {
  apiBase?: string
  initialMetrics?: DashboardMetrics
}

export function DashboardStats({ apiBase = "", initialMetrics }: Props) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(initialMetrics ?? null)
  const [loading, setLoading] = useState(!initialMetrics)
  const [error, setError] = useState("")

  const fetchMetrics = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await adminApiFetch(apiBase, "/api/_metrics")
      const data = await res.json()
      if (!res.ok)
        throw new Error(
          data.error && res.status !== 401 && res.status !== 403
            ? data.error
            : messageForAdminResponse(res, "Failed to load dashboard metrics"),
        )
      setMetrics(data)
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard metrics")
    } finally {
      setLoading(false)
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetch is intentionally scoped to apiBase; fetchMetrics is recreated each render and initialMetrics is only a mount-time guard, so listing them would re-fetch unnecessarily
  useEffect(() => {
    if (initialMetrics) return
    fetchMetrics()
  }, [apiBase])

  const needsReview = useMemo(
    () => (metrics?.collections ?? []).filter((collection) => collection.inReview > 0),
    [metrics],
  )

  if (loading) {
    return (
      <div className="space-y-5">
        <LoadingState
          title="Loading dashboard metrics"
          description="Collecting content, media, and activity totals."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#18181b] p-5 animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <ErrorState
        title={
          error === "Sign in to continue." || error.startsWith("You do not have permission")
            ? "Permission needed"
            : "Dashboard metrics unavailable"
        }
        description={error}
        action={
          <button
            type="button"
            onClick={fetchMetrics}
            className="rounded-md bg-[rgba(255,255,255,0.08)] px-3 py-1.5 text-sm font-medium text-[#fafafa] hover:bg-[rgba(255,255,255,0.12)]"
          >
            Try again
          </button>
        }
      />
    )
  }

  if (!metrics || metrics.collections.length === 0) {
    return (
      <EmptyState
        title="No collections yet"
        description="Dashboard metrics will appear after collections are registered."
      />
    )
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-[#909099]">
            Content Health
          </h2>
          <p className="text-sm text-[#909099]">
            {metrics.totals?.content ?? totalContent(metrics.collections)} total content items
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {metrics.collections.map((collection) => (
            <a
              key={collection.name}
              href={`/content/${collection.name}`}
              className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#18181b] p-5 transition-colors hover:border-[rgba(198,255,61,0.24)]"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-[#fafafa]">{collection.label}</span>
                <FileText className="h-4 w-4 text-[#909099]" />
              </div>
              <p className="text-2xl font-semibold text-[#fafafa]">{collection.total} total</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[#909099]">
                <span>{collection.drafts} drafts</span>
                <span>{collection.inReview} in review</span>
                <span>{collection.published} published</span>
                <span>{collection.scheduled} scheduled</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#18181b] p-5">
          <div className="mb-4 flex items-center gap-2">
            <PenLine className="h-4 w-4 text-[#909099]" />
            <h3 className="text-sm font-medium text-[#fafafa]">Needs review</h3>
          </div>
          {needsReview.length === 0 ? (
            <p className="text-sm text-[#909099]">No content is waiting for review.</p>
          ) : (
            <div className="divide-y divide-[rgba(255,255,255,0.06)]">
              {needsReview.map((collection) => (
                <a
                  key={collection.name}
                  href={`/content/${collection.name}?where=${encodeURIComponent(JSON.stringify({ status: "in_review" }))}`}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <span className="text-[#a1a1aa]">{collection.label}</span>
                  <span className="rounded-full bg-[rgba(198,255,61,0.12)] px-2 py-0.5 text-xs text-[#c6ff3d]">
                    {collection.inReview}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#18181b] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Image className="h-4 w-4 text-[#909099]" />
            <h3 className="text-sm font-medium text-[#fafafa]">Media</h3>
          </div>
          <p className="text-2xl font-semibold text-[#fafafa]">{metrics.media.total} assets</p>
          <a href="/media" className="mt-3 inline-flex text-sm text-[#c6ff3d] hover:text-[#d4ff6e]">
            Open library
          </a>
        </div>
      </section>

      <section className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#18181b] p-5">
        <div className="mb-4 flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-[#909099]" />
          <h3 className="text-sm font-medium text-[#fafafa]">Recent activity</h3>
        </div>
        {metrics.recentAudit.length === 0 ? (
          <p className="text-sm text-[#909099]">No recent activity yet.</p>
        ) : (
          <div className="divide-y divide-[rgba(255,255,255,0.06)]">
            {metrics.recentAudit.map((event) => (
              <div key={event.id} className="py-3">
                <p className="text-sm text-[#a1a1aa]">{event.summary || event.action}</p>
                <p className="mt-1 text-xs text-[#838389]">
                  {event.collection || "system"} · {formatDate(event.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function totalContent(collections: DashboardCollectionMetric[]) {
  return collections.reduce((sum, collection) => sum + collection.total, 0)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
