import { useEffect, useState } from "react"
import { adminApiFetch, messageForAdminResponse } from "../lib/api"
import { EmptyState, ErrorState, LoadingState } from "./AdminState"

type Webhook = {
  id: string
  url: string
  events: string[]
  collection?: string
  secret?: string
  active: boolean
  created_at: string
}

type WebhookDelivery = {
  id: string
  webhook_id: string
  event: string
  status: number
  request_body: string
  response_body?: string
  attempts: number
  created_at: string
}

type Props = {
  apiBase?: string
}

export function WebhookManager({ apiBase = "" }: Props) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formUrl, setFormUrl] = useState("")
  const [formEvents, setFormEvents] = useState<string[]>(["content:afterPublish"])
  const [formCollection, setFormCollection] = useState("")
  const [formSecret, setFormSecret] = useState("")
  const [error, setError] = useState("")
  const [logsByWebhook, setLogsByWebhook] = useState<Record<string, WebhookDelivery[]>>({})
  const [replayingLogId, setReplayingLogId] = useState("")

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only fetch; fetchWebhooks is recreated each render so adding it would re-run on every render
  useEffect(() => {
    fetchWebhooks()
  }, [])

  const fetchWebhooks = async () => {
    setError("")
    try {
      const res = await adminApiFetch(apiBase, "/api/_webhooks")
      if (res.ok) {
        const data = await res.json()
        const hooks = data.data || []
        setWebhooks(hooks)
        fetchLogs(hooks)
      } else {
        setError(messageForAdminResponse(res, "Could not load webhooks."))
      }
    } catch {
      setError("Could not reach the server.")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    const res = await adminApiFetch(apiBase, "/api/_webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: formUrl,
        events: formEvents,
        collection: formCollection || undefined,
        secret: formSecret || undefined,
        active: true,
      }),
    })
    if (res.ok) {
      setShowForm(false)
      setFormUrl("")
      setFormSecret("")
      setFormCollection("")
      fetchWebhooks()
    } else {
      setError(messageForAdminResponse(res, "Could not create webhook."))
    }
  }

  const fetchLogs = async (hooks: Webhook[]) => {
    const entries = await Promise.all(
      hooks.map(async (hook) => {
        const res = await adminApiFetch(apiBase, `/api/_webhooks/${hook.id}/logs`)
        if (!res.ok) return [hook.id, []] as const
        const body = await res.json()
        return [hook.id, body.data || []] as const
      }),
    )
    setLogsByWebhook(Object.fromEntries(entries))
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this webhook?")) return
    await adminApiFetch(apiBase, `/api/_webhooks/${id}`, { method: "DELETE" })
    fetchWebhooks()
  }

  const handleToggle = async (hook: Webhook) => {
    await adminApiFetch(apiBase, `/api/_webhooks/${hook.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !hook.active }),
    })
    fetchWebhooks()
  }

  const handleReplay = async (hook: Webhook, log: WebhookDelivery) => {
    setReplayingLogId(log.id)
    setError("")
    try {
      const res = await adminApiFetch(apiBase, `/api/_webhooks/${hook.id}/logs/${log.id}/replay`, {
        method: "POST",
      })
      if (!res.ok)
        throw new Error(messageForAdminResponse(res, "Could not replay webhook delivery."))
      await fetchWebhooks()
    } catch (err: any) {
      setError(err.message || "Could not replay webhook delivery.")
    } finally {
      setReplayingLogId("")
    }
  }

  const allEvents = [
    "content:afterSave",
    "content:afterPublish",
    "content:afterDelete",
    "media:afterUpload",
  ]

  if (loading)
    return <LoadingState title="Loading webhooks" description="Fetching delivery endpoints." />

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-[#c6ff3d] text-[#0a0a0c] rounded-lg text-sm font-medium hover:bg-[#d4ff6e] transition-colors"
        >
          + Add Webhook
        </button>
      </div>

      {error && (
        <ErrorState
          title="Webhook action failed"
          description={error}
          action={
            <button
              type="button"
              onClick={fetchWebhooks}
              className="px-3 py-1.5 text-sm font-medium text-[#fafafa] bg-[rgba(255,255,255,0.08)] rounded-md hover:bg-[rgba(255,255,255,0.12)] transition-colors"
            >
              Try again
            </button>
          }
        />
      )}

      {showForm && (
        <div className="bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] p-6 space-y-4">
          <div>
            <label htmlFor="webhook-url" className="block text-sm font-medium text-[#a1a1aa] mb-1">
              URL
            </label>
            <input
              id="webhook-url"
              type="url"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://example.com/webhook"
              className="w-full px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-transparent text-[#fafafa] placeholder:text-[#52525b] focus:border-[#c6ff3d] focus:outline-none focus:ring-0"
            />
          </div>
          <div>
            <span className="block text-sm font-medium text-[#a1a1aa] mb-1">Events</span>
            <div className="space-y-1">
              {allEvents.map((evt) => (
                <label key={evt} className="flex items-center gap-2 text-sm text-[#a1a1aa]">
                  <input
                    type="checkbox"
                    checked={formEvents.includes(evt)}
                    onChange={(e) => {
                      if (e.target.checked) setFormEvents([...formEvents, evt])
                      else setFormEvents(formEvents.filter((e2) => e2 !== evt))
                    }}
                    className="accent-[#c6ff3d]"
                  />
                  {evt}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label
              htmlFor="webhook-collection"
              className="block text-sm font-medium text-[#a1a1aa] mb-1"
            >
              Collection (optional)
            </label>
            <input
              id="webhook-collection"
              type="text"
              value={formCollection}
              onChange={(e) => setFormCollection(e.target.value)}
              placeholder="blog_post"
              className="w-full px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-transparent text-[#fafafa] placeholder:text-[#52525b] focus:border-[#c6ff3d] focus:outline-none focus:ring-0"
            />
          </div>
          <div>
            <label
              htmlFor="webhook-secret"
              className="block text-sm font-medium text-[#a1a1aa] mb-1"
            >
              Secret (optional, for HMAC signing)
            </label>
            <input
              id="webhook-secret"
              type="text"
              value={formSecret}
              onChange={(e) => setFormSecret(e.target.value)}
              placeholder="webhook-secret"
              className="w-full px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-transparent text-[#fafafa] placeholder:text-[#52525b] focus:border-[#c6ff3d] focus:outline-none focus:ring-0"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!formUrl}
              className="px-4 py-2 bg-[#c6ff3d] text-[#0a0a0c] rounded-lg text-sm font-medium hover:bg-[#d4ff6e] disabled:opacity-50 transition-colors"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-[rgba(255,255,255,0.06)] text-[#a1a1aa] rounded-lg text-sm hover:bg-[rgba(255,255,255,0.03)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {webhooks.length === 0 ? (
        <EmptyState
          title="No webhooks configured"
          description="Notify external services when content changes. Trigger deploys, sync data, or send messages to other tools."
        />
      ) : (
        <div className="bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] divide-y divide-[rgba(255,255,255,0.06)]">
          {webhooks.map((hook) => (
            <div key={hook.id} className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-[#fafafa]">{hook.url}</p>
                  <div className="flex gap-1 mt-1">
                    {hook.events.map((evt) => (
                      <span
                        key={evt}
                        className="text-xs bg-[rgba(255,255,255,0.05)] text-[#71717a] px-2 py-0.5 rounded-full"
                      >
                        {evt}
                      </span>
                    ))}
                    {hook.collection && (
                      <span className="text-xs bg-[rgba(255,255,255,0.08)] text-[#a1a1aa] px-2 py-0.5 rounded-full">
                        {hook.collection}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggle(hook)}
                    className={`text-xs px-2 py-1 rounded-full ${hook.active ? "bg-[rgba(34,197,94,0.1)] text-[#22c55e]" : "bg-[rgba(255,255,255,0.05)] text-[#71717a]"}`}
                  >
                    {hook.active ? "Active" : "Inactive"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(hook.id)}
                    className="text-xs text-[#52525b] hover:text-[#ef4444] transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0a0a0c] overflow-hidden">
                <div className="px-3 py-2 border-b border-[rgba(255,255,255,0.06)] text-xs font-semibold uppercase tracking-wide text-[#71717a]">
                  Delivery log
                </div>
                {(logsByWebhook[hook.id] ?? []).length === 0 ? (
                  <p className="px-3 py-4 text-sm text-[#52525b]">No deliveries yet.</p>
                ) : (
                  <div className="divide-y divide-[rgba(255,255,255,0.06)]">
                    {(logsByWebhook[hook.id] ?? []).slice(0, 5).map((log) => (
                      <div
                        key={log.id}
                        className="grid gap-3 px-3 py-3 text-sm md:grid-cols-[92px_1fr_auto]"
                      >
                        <span
                          className={
                            log.status >= 200 && log.status < 300
                              ? "text-[#22c55e]"
                              : "text-[#ef4444]"
                          }
                        >
                          {log.status || "error"}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs text-[#71717a]">
                            {log.event} · {new Date(log.created_at).toLocaleString()}
                          </p>
                          {log.response_body && (
                            <p className="mt-1 truncate text-xs text-[#a1a1aa]">
                              {log.response_body}
                            </p>
                          )}
                        </div>
                        {(log.status < 200 || log.status >= 300) && (
                          <button
                            type="button"
                            onClick={() => handleReplay(hook, log)}
                            disabled={replayingLogId === log.id}
                            className="rounded-md border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs text-[#fafafa] hover:bg-[rgba(255,255,255,0.06)] disabled:opacity-50"
                          >
                            {replayingLogId === log.id ? "Replaying..." : "Replay"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
