import { useEffect, useState } from "react"
import { adminApiFetch, messageForAdminResponse } from "../lib/api"
import { ErrorState, LoadingState } from "./AdminState"

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
  const [saveError, setSaveError] = useState("")

  useEffect(() => {
    adminApiFetch(apiBase, "/api/_settings?prefix=theme.")
      .then((r) => (r.ok ? r.json() : { data: {} }))
      .then((res) => setSettings({ ...DEFAULTS, ...res.data }))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [apiBase])

  const handleSave = async () => {
    setSaving(true)
    setSaveError("")
    try {
      const res = await adminApiFetch(apiBase, "/api/_settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error(messageForAdminResponse(res, "Could not save settings."))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      setSaveError(err.message || "Could not save settings. Make sure the API is running.")
    } finally {
      setSaving(false)
    }
  }

  const update = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  if (loading)
    return (
      <LoadingState title="Loading theme settings" description="Fetching saved theme controls." />
    )

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-semibold text-[#fafafa]">Theme Settings</h2>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-[#c6ff3d] text-[#0a0a0c] rounded-lg text-sm font-medium hover:bg-[#d4ff6e] disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      {saveError && (
        <ErrorState compact title="Theme settings were not saved" description={saveError} />
      )}

      <div className="bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] p-6 space-y-6">
        <div>
          <label
            htmlFor="theme-primary-color"
            className="block text-sm font-medium text-[#a1a1aa] mb-1"
          >
            Primary Color
          </label>
          <div className="flex gap-3 items-center">
            <input
              id="theme-primary-color"
              type="color"
              value={settings["theme.primaryColor"]}
              onChange={(e) => update("theme.primaryColor", e.target.value)}
              className="w-10 h-10 rounded border border-[rgba(255,255,255,0.1)] cursor-pointer bg-transparent"
            />
            <input
              type="text"
              value={settings["theme.primaryColor"]}
              onChange={(e) => update("theme.primaryColor", e.target.value)}
              className="flex-1 px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-transparent text-[#fafafa] placeholder:text-[#52525b] focus:border-[#c6ff3d] focus:outline-none focus:ring-0"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="theme-font-family"
            className="block text-sm font-medium text-[#a1a1aa] mb-1"
          >
            Font Family
          </label>
          <select
            id="theme-font-family"
            value={settings["theme.fontFamily"]}
            onChange={(e) => update("theme.fontFamily", e.target.value)}
            className="w-full px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-[#18181b] text-[#fafafa] focus:border-[#c6ff3d] focus:outline-none focus:ring-0"
          >
            <option value="system-ui, -apple-system, sans-serif">System (Default)</option>
            <option value="Georgia, serif">Georgia (Serif)</option>
            <option value="'Inter', sans-serif">Inter</option>
            <option value="'Merriweather', serif">Merriweather</option>
            <option value="monospace">Monospace</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="theme-header-style"
            className="block text-sm font-medium text-[#a1a1aa] mb-1"
          >
            Header Style
          </label>
          <select
            id="theme-header-style"
            value={settings["theme.headerStyle"]}
            onChange={(e) => update("theme.headerStyle", e.target.value)}
            className="w-full px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-[#18181b] text-[#fafafa] focus:border-[#c6ff3d] focus:outline-none focus:ring-0"
          >
            <option value="simple">Simple</option>
            <option value="centered">Centered</option>
            <option value="minimal">Minimal</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="theme-max-width"
            className="block text-sm font-medium text-[#a1a1aa] mb-1"
          >
            Max Content Width
          </label>
          <select
            id="theme-max-width"
            value={settings["theme.maxWidth"]}
            onChange={(e) => update("theme.maxWidth", e.target.value)}
            className="w-full px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-[#18181b] text-[#fafafa] focus:border-[#c6ff3d] focus:outline-none focus:ring-0"
          >
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
