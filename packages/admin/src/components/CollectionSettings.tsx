import { Save } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { RoleDefinition } from "../lib/access"
import {
  type CollectionAccessSettings,
  type CollectionSettingsEntry,
  type CollectionSettingsInput,
  listCollectionSettings,
  saveCollectionSettings,
} from "../lib/collections"
import { ErrorState, LoadingState } from "./AdminState"

type Props = {
  apiBase?: string
  initialCollections?: CollectionSettingsEntry[]
  initialRoles?: RoleDefinition[]
}

const ACTIONS: Array<keyof CollectionAccessSettings> = ["read", "create", "update", "delete"]
const inputClass =
  "w-full px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-transparent text-[#fafafa] placeholder:text-[#838389] focus:border-[#c6ff3d] focus:outline-none"

function labelAction(action: keyof CollectionAccessSettings) {
  return action.charAt(0).toUpperCase() + action.slice(1)
}

export function CollectionSettings({
  apiBase = "",
  initialCollections = [],
  initialRoles = [],
}: Props) {
  const [collections, setCollections] = useState<CollectionSettingsEntry[]>(initialCollections)
  const [roles, setRoles] = useState<RoleDefinition[]>(initialRoles)
  const [activeName, setActiveName] = useState(initialCollections[0]?.name ?? "")
  const [loading, setLoading] = useState(initialCollections.length === 0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (initialCollections.length > 0) return
    let cancelled = false
    listCollectionSettings(apiBase)
      .then((result) => {
        if (cancelled) return
        setCollections(result.data)
        setRoles(result.roles)
        setActiveName(result.data[0]?.name ?? "")
      })
      .catch(() => {
        if (!cancelled) setError("Could not load collection settings.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [apiBase, initialCollections.length])

  const active = useMemo(
    () => collections.find((collection) => collection.name === activeName) ?? collections[0],
    [activeName, collections],
  )

  const updateActiveSettings = (patch: CollectionSettingsInput) => {
    if (!active) return
    setSaved(false)
    setCollections((current) =>
      current.map((entry) => {
        if (entry.name !== active.name) return entry
        return { ...entry, settings: { ...entry.settings, ...patch } }
      }),
    )
  }

  const updateAccess = (action: keyof CollectionAccessSettings, role: string, checked: boolean) => {
    if (!active) return
    const current = new Set(active.settings.access?.[action] ?? [])
    if (checked) current.add(role)
    else current.delete(role)
    updateActiveSettings({
      access: {
        ...active.settings.access,
        [action]: Array.from(current),
      },
    })
  }

  const updateSearchField = (field: string, checked: boolean) => {
    if (!active) return
    const current = new Set(active.settings.searchFields ?? [])
    if (checked) current.add(field)
    else current.delete(field)
    updateActiveSettings({ searchFields: Array.from(current) })
  }

  const handleSave = async () => {
    if (!active) return
    setSaving(true)
    setError("")
    try {
      const savedEntry = await saveCollectionSettings(apiBase, active.name, active.settings)
      setCollections((current) =>
        current.map((entry) => (entry.name === savedEntry.name ? savedEntry : entry)),
      )
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError("Could not save collection settings.")
    } finally {
      setSaving(false)
    }
  }

  const fieldEntries = Object.entries(active?.fields ?? {})

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#fafafa]">Collection Settings</h2>
          <p className="text-sm text-[#909099]">
            Configure labels, access, preview paths, search, and editor layout.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading || !active}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#c6ff3d] text-[#0a0a0c] rounded-lg text-sm font-medium hover:bg-[#d4ff6e] disabled:opacity-50 transition-colors"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : saved ? "Saved" : "Save Collection"}
        </button>
      </div>

      {error && <ErrorState compact title="Collection settings unavailable" description={error} />}

      <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#18181b]">
        <div className="flex gap-1 overflow-x-auto border-b border-[rgba(255,255,255,0.06)] px-4 pt-4">
          {loading ? (
            <div className="pb-4">
              <LoadingState
                compact
                title="Loading collections"
                description="Fetching editable collection settings."
              />
            </div>
          ) : (
            collections.map((collection) => (
              <button
                key={collection.name}
                type="button"
                onClick={() => setActiveName(collection.name)}
                className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${collection.name === active?.name ? "bg-[#0a0a0c] text-[#fafafa]" : "text-[#909099] hover:text-[#a1a1aa]"}`}
              >
                {collection.labels.plural}
              </button>
            ))
          )}
        </div>

        {active && (
          <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-[#909099]">Singular label</span>
                  <input
                    value={active.settings.labels?.singular ?? active.labels.singular}
                    onChange={(event) =>
                      updateActiveSettings({
                        labels: { ...active.settings.labels, singular: event.target.value },
                      })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-[#909099]">Plural label</span>
                  <input
                    value={active.settings.labels?.plural ?? active.labels.plural}
                    onChange={(event) =>
                      updateActiveSettings({
                        labels: { ...active.settings.labels, plural: event.target.value },
                      })
                    }
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-[#909099]">Preview path</span>
                <input
                  value={active.settings.previewPath ?? ""}
                  onChange={(event) => updateActiveSettings({ previewPath: event.target.value })}
                  placeholder="/blog/:slug"
                  className={inputClass}
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-[#909099]">Editor layout</span>
                <select
                  value={active.settings.editorLayout ?? "default"}
                  onChange={(event) => updateActiveSettings({ editorLayout: event.target.value })}
                  className="w-full px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-[#18181b] text-[#fafafa] focus:border-[#c6ff3d] focus:outline-none"
                >
                  <option value="default">Default</option>
                  <option value="sidebar">Sidebar</option>
                  <option value="full_width">Full width</option>
                </select>
              </label>

              <div className="space-y-3">
                <h3 className="text-sm font-medium text-[#fafafa]">Access roles</h3>
                <div className="overflow-hidden rounded-lg border border-[rgba(255,255,255,0.06)]">
                  {ACTIONS.map((action) => (
                    <div
                      key={action}
                      className="grid gap-3 border-b border-[rgba(255,255,255,0.06)] px-4 py-3 last:border-b-0 md:grid-cols-[90px_1fr]"
                    >
                      <span className="text-sm font-medium text-[#a1a1aa]">
                        {labelAction(action)}
                      </span>
                      <div className="flex flex-wrap gap-3">
                        {roles.map((role) => (
                          <label
                            key={`${action}-${role.key}`}
                            className="inline-flex items-center gap-2 text-sm text-[#a1a1aa]"
                          >
                            <input
                              type="checkbox"
                              checked={(active.settings.access?.[action] ?? []).includes(role.key)}
                              onChange={(event) =>
                                updateAccess(action, role.key, event.target.checked)
                              }
                            />
                            {role.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-medium text-[#fafafa]">Search fields</h3>
                <div className="flex flex-wrap gap-3">
                  {fieldEntries.map(([name, def]) => (
                    <label
                      key={name}
                      className="inline-flex items-center gap-2 text-sm text-[#a1a1aa]"
                    >
                      <input
                        type="checkbox"
                        checked={(active.settings.searchFields ?? []).includes(name)}
                        onChange={(event) => updateSearchField(name, event.target.checked)}
                      />
                      {name} <span className="text-xs text-[#838389]">{def.type}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <aside className="space-y-3 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0a0a0c] p-4">
              <h3 className="text-sm font-medium text-[#fafafa]">Code-defined fields</h3>
              <div className="divide-y divide-[rgba(255,255,255,0.06)]">
                {fieldEntries.map(([name, def]) => (
                  <div key={name} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-sm text-[#a1a1aa]">{name}</span>
                    <span className="text-xs text-[#838389]">{def.type}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        )}
      </div>
    </section>
  )
}
