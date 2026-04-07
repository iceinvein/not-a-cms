import { useState, useEffect } from "react"

type Webhook = {
  id: string
  url: string
  events: string[]
  collection?: string
  secret?: string
  active: boolean
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

  useEffect(() => {
    fetchWebhooks()
  }, [])

  const fetchWebhooks = async () => {
    try {
      const res = await fetch(`${apiBase}/api/_webhooks`)
      if (res.ok) {
        const data = await res.json()
        setWebhooks(data.data || [])
      }
    } catch {} finally { setLoading(false) }
  }

  const handleCreate = async () => {
    const res = await fetch(`${apiBase}/api/_webhooks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: formUrl, events: formEvents, collection: formCollection || undefined, secret: formSecret || undefined, active: true }),
    })
    if (res.ok) {
      setShowForm(false)
      setFormUrl("")
      setFormSecret("")
      setFormCollection("")
      fetchWebhooks()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this webhook?")) return
    await fetch(`${apiBase}/api/_webhooks/${id}`, { method: "DELETE" })
    fetchWebhooks()
  }

  const handleToggle = async (hook: Webhook) => {
    await fetch(`${apiBase}/api/_webhooks/${hook.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !hook.active }),
    })
    fetchWebhooks()
  }

  const allEvents = ["content:afterSave", "content:afterPublish", "content:afterDelete", "media:afterUpload"]

  if (loading) return <p className="text-[#52525b] text-sm">Loading webhooks...</p>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-[#fafafa]">Webhooks</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-[#fafafa] text-[#0a0a0c] rounded-lg text-sm font-medium hover:bg-[#e4e4e7]">
          + Add Webhook
        </button>
      </div>

      {showForm && (
        <div className="bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#a1a1aa] mb-1">URL</label>
            <input type="url" value={formUrl} onChange={(e) => setFormUrl(e.target.value)} placeholder="https://example.com/webhook" className="w-full px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-transparent text-[#fafafa] placeholder:text-[#52525b] focus:border-[rgba(255,255,255,0.2)] focus:outline-none focus:ring-0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Events</label>
            <div className="space-y-1">
              {allEvents.map((evt) => (
                <label key={evt} className="flex items-center gap-2 text-sm text-[#a1a1aa]">
                  <input type="checkbox" checked={formEvents.includes(evt)} onChange={(e) => {
                    if (e.target.checked) setFormEvents([...formEvents, evt])
                    else setFormEvents(formEvents.filter((e2) => e2 !== evt))
                  }} />
                  {evt}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Collection (optional)</label>
            <input type="text" value={formCollection} onChange={(e) => setFormCollection(e.target.value)} placeholder="blog_post" className="w-full px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-transparent text-[#fafafa] placeholder:text-[#52525b] focus:border-[rgba(255,255,255,0.2)] focus:outline-none focus:ring-0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Secret (optional, for HMAC signing)</label>
            <input type="text" value={formSecret} onChange={(e) => setFormSecret(e.target.value)} placeholder="webhook-secret" className="w-full px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-transparent text-[#fafafa] placeholder:text-[#52525b] focus:border-[rgba(255,255,255,0.2)] focus:outline-none focus:ring-0" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={!formUrl} className="px-4 py-2 bg-[#fafafa] text-[#0a0a0c] rounded-lg text-sm font-medium hover:bg-[#e4e4e7] disabled:opacity-50">Create</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-[rgba(255,255,255,0.06)] text-[#a1a1aa] rounded-lg text-sm hover:bg-[rgba(255,255,255,0.03)]">Cancel</button>
          </div>
        </div>
      )}

      {webhooks.length === 0 ? (
        <div className="bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] p-12 text-center text-[#52525b]">No webhooks configured</div>
      ) : (
        <div className="bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] divide-y divide-[rgba(255,255,255,0.06)]">
          {webhooks.map((hook) => (
            <div key={hook.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#fafafa]">{hook.url}</p>
                <div className="flex gap-1 mt-1">
                  {hook.events.map((evt) => (
                    <span key={evt} className="text-xs bg-[rgba(255,255,255,0.05)] text-[#71717a] px-2 py-0.5 rounded-full">{evt}</span>
                  ))}
                  {hook.collection && <span className="text-xs bg-[rgba(255,255,255,0.08)] text-[#a1a1aa] px-2 py-0.5 rounded-full">{hook.collection}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => handleToggle(hook)} className={`text-xs px-2 py-1 rounded-full ${hook.active ? "bg-[rgba(34,197,94,0.1)] text-[#22c55e]" : "bg-[rgba(255,255,255,0.05)] text-[#71717a]"}`}>
                  {hook.active ? "Active" : "Inactive"}
                </button>
                <button onClick={() => handleDelete(hook.id)} className="text-xs text-[#52525b] hover:text-[#ef4444]">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
