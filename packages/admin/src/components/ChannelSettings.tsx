import { useEffect, useState } from "react"
import { Rss, Mail, Save } from "lucide-react"
import { ErrorState, LoadingState } from "./AdminState"
import { adminApiFetch, messageForAdminResponse } from "../lib/api"

type Props = {
  apiBase?: string
  initialSettings?: ChannelSettingsMap
}

type ChannelSettingsMap = {
  "channel.rss.title": string
  "channel.rss.description": string
  "channel.rss.language": string
  "channel.rss.collection": string
  "channel.rss.itemPath": string
  "channel.email.title": string
  "channel.email.preheader": string
  "channel.email.footerText": string
  "channel.email.fromName": string
  "channel.email.subjectPrefix": string
  [key: string]: string
}

const DEFAULTS: ChannelSettingsMap = {
  "channel.rss.title": "not-a-cms",
  "channel.rss.description": "A site powered by not-a-cms",
  "channel.rss.language": "en",
  "channel.rss.collection": "blog_post",
  "channel.rss.itemPath": "/blog/:slug",
  "channel.email.title": "Newsletter",
  "channel.email.preheader": "",
  "channel.email.footerText": "Powered by not-a-cms",
  "channel.email.fromName": "",
  "channel.email.subjectPrefix": "",
}

const inputClass = "w-full px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-transparent text-[#fafafa] placeholder:text-[#52525b] focus:border-[#c9956b] focus:outline-none"

export function ChannelSettings({ apiBase = "", initialSettings }: Props) {
  const [settings, setSettings] = useState<ChannelSettingsMap>({ ...DEFAULTS, ...initialSettings })
  const [loading, setLoading] = useState(!initialSettings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (initialSettings) return
    let cancelled = false
    adminApiFetch(apiBase, "/api/_channel-settings")
      .then((res) => res.ok ? res.json() : { data: {} })
      .then((body) => {
        if (!cancelled) setSettings({ ...DEFAULTS, ...body.data })
      })
      .catch(() => {
        if (!cancelled) setError("Could not load channel settings.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [apiBase, initialSettings])

  const update = (key: keyof ChannelSettingsMap, value: string) => {
    setSaved(false)
    setSettings((current) => ({ ...current, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError("")
    try {
      const res = await adminApiFetch(apiBase, "/api/_settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error(messageForAdminResponse(res, "Could not save channel settings."))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      setError(err.message || "Could not save channel settings.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState title="Loading channel settings" description="Fetching RSS and email controls." />

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#fafafa]">Channel Settings</h2>
          <p className="text-sm text-[#71717a]">Configure the public RSS feed and default email rendering metadata.</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#c9956b] text-[#0a0a0c] rounded-lg text-sm font-medium hover:bg-[#d4a57c] disabled:opacity-50 transition-colors"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : saved ? "Saved" : "Save Channels"}
        </button>
      </div>

      {error && <ErrorState compact title="Channel settings unavailable" description={error} />}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#18181b] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Rss className="h-4 w-4 text-[#c9956b]" />
            <h3 className="text-sm font-medium text-[#fafafa]">RSS</h3>
          </div>
          <TextField label="Feed title" value={settings["channel.rss.title"]} onChange={(value) => update("channel.rss.title", value)} />
          <TextField label="Description" value={settings["channel.rss.description"]} onChange={(value) => update("channel.rss.description", value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Language" value={settings["channel.rss.language"]} onChange={(value) => update("channel.rss.language", value)} />
            <TextField label="Collection" value={settings["channel.rss.collection"]} onChange={(value) => update("channel.rss.collection", value)} />
          </div>
          <TextField label="Item path" value={settings["channel.rss.itemPath"]} onChange={(value) => update("channel.rss.itemPath", value)} />
        </div>

        <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#18181b] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-[#c9956b]" />
            <h3 className="text-sm font-medium text-[#fafafa]">Email</h3>
          </div>
          <TextField label="Template title" value={settings["channel.email.title"]} onChange={(value) => update("channel.email.title", value)} />
          <TextField label="Preheader" value={settings["channel.email.preheader"]} onChange={(value) => update("channel.email.preheader", value)} />
          <TextField label="Footer text" value={settings["channel.email.footerText"]} onChange={(value) => update("channel.email.footerText", value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="From name" value={settings["channel.email.fromName"]} onChange={(value) => update("channel.email.fromName", value)} />
            <TextField label="Subject prefix" value={settings["channel.email.subjectPrefix"]} onChange={(value) => update("channel.email.subjectPrefix", value)} />
          </div>
        </div>
      </div>
    </section>
  )
}

function TextField(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-[#71717a]">{props.label}</span>
      <input value={props.value} onChange={(event) => props.onChange(event.target.value)} className={inputClass} />
    </label>
  )
}
