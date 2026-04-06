import { useState, useEffect } from "react"

type Props = {
  apiBase?: string
}

type ThemeSettings = {
  "theme.primaryColor": string
  "theme.fontFamily": string
  "theme.headerStyle": string
  "theme.maxWidth": string
  [key: string]: string
}

const DEFAULTS: ThemeSettings = {
  "theme.primaryColor": "#1f2937",
  "theme.fontFamily": "system-ui, -apple-system, sans-serif",
  "theme.headerStyle": "simple",
  "theme.maxWidth": "4xl",
}

export function ThemeCustomizer({ apiBase = "" }: Props) {
  const [settings, setSettings] = useState<ThemeSettings>({ ...DEFAULTS })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`${apiBase}/api/_settings?prefix=theme.`)
      .then((r) => r.ok ? r.json() : { data: {} })
      .then((res) => setSettings({ ...DEFAULTS, ...res.data }))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [apiBase])

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`${apiBase}/api/_settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {} finally { setSaving(false) }
  }

  const update = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading theme settings...</p>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Theme Settings</h2>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
          <div className="flex gap-3 items-center">
            <input type="color" value={settings["theme.primaryColor"]} onChange={(e) => update("theme.primaryColor", e.target.value)} className="w-10 h-10 rounded border border-gray-300 cursor-pointer" />
            <input type="text" value={settings["theme.primaryColor"]} onChange={(e) => update("theme.primaryColor", e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Font Family</label>
          <select value={settings["theme.fontFamily"]} onChange={(e) => update("theme.fontFamily", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="system-ui, -apple-system, sans-serif">System (Default)</option>
            <option value="Georgia, serif">Georgia (Serif)</option>
            <option value="'Inter', sans-serif">Inter</option>
            <option value="'Merriweather', serif">Merriweather</option>
            <option value="monospace">Monospace</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Header Style</label>
          <select value={settings["theme.headerStyle"]} onChange={(e) => update("theme.headerStyle", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="simple">Simple</option>
            <option value="centered">Centered</option>
            <option value="minimal">Minimal</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Content Width</label>
          <select value={settings["theme.maxWidth"]} onChange={(e) => update("theme.maxWidth", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="2xl">Narrow (2xl)</option>
            <option value="4xl">Medium (4xl)</option>
            <option value="6xl">Wide (6xl)</option>
            <option value="full">Full Width</option>
          </select>
        </div>
      </div>
    </div>
  )
}
