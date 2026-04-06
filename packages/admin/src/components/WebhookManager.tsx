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

  if (loading) return <p className="text-gray-400 text-sm">Loading webhooks...</p>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Webhooks</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          + Add Webhook
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
            <input type="url" value={formUrl} onChange={(e) => setFormUrl(e.target.value)} placeholder="https://example.com/webhook" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Events</label>
            <div className="space-y-1">
              {allEvents.map((evt) => (
                <label key={evt} className="flex items-center gap-2 text-sm">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Collection (optional)</label>
            <input type="text" value={formCollection} onChange={(e) => setFormCollection(e.target.value)} placeholder="blog_post" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Secret (optional, for HMAC signing)</label>
            <input type="text" value={formSecret} onChange={(e) => setFormSecret(e.target.value)} placeholder="webhook-secret" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={!formUrl} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Create</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {webhooks.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">No webhooks configured</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {webhooks.map((hook) => (
            <div key={hook.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{hook.url}</p>
                <div className="flex gap-1 mt-1">
                  {hook.events.map((evt) => (
                    <span key={evt} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{evt}</span>
                  ))}
                  {hook.collection && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{hook.collection}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => handleToggle(hook)} className={`text-xs px-2 py-1 rounded-full ${hook.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {hook.active ? "Active" : "Inactive"}
                </button>
                <button onClick={() => handleDelete(hook.id)} className="text-xs text-red-600 hover:text-red-800">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
