import { useState, useEffect, lazy, Suspense } from "react"

// Lazy import to avoid Vite resolving bun:sqlite through the editor's dependency chain
const Editor = lazy(() => import("@not-a-cms/editor").then(m => ({ default: m.Editor })))

// Inline slugify to avoid pulling @not-a-cms/core (which imports bun:sqlite) into the Vite bundle
function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

type FieldDef = {
  type: string
  required?: boolean
  maxLength?: number
  options?: string[]
  default?: unknown
  from?: string
  [key: string]: unknown
}

type Props = {
  collection: string
  collectionLabel: string
  fields: Record<string, FieldDef>
  initialData?: Record<string, unknown>
  documentId?: string
  apiBase?: string
}

export function ContentEditor({
  collection,
  collectionLabel,
  fields,
  initialData,
  documentId,
  apiBase = "",
}: Props) {
  // Initialize with defaults from field definitions
  const [data, setData] = useState<Record<string, unknown>>(() => {
    const defaults: Record<string, unknown> = {}
    for (const [name, def] of Object.entries(fields)) {
      if (def.default !== undefined) defaults[name] = def.default
    }
    return { ...defaults, ...initialData }
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (documentId) {
      fetch(`${apiBase}/api/${collection}/${documentId}`)
        .then((res) => res.ok ? res.json() : null)
        .then((doc) => { if (doc) setData(doc) })
        .catch(() => {})
    }
  }, [documentId, collection, apiBase])

  const updateField = (name: string, value: unknown) => {
    setData((prev) => ({ ...prev, [name]: value }))
    setSaved(false)
  }

  const handleSave = async (publish = false) => {
    setSaving(true)
    setError("")
    setSaved(false)

    try {
      const payload = { ...data }
      if (publish) payload.status = "published"

      const url = documentId
        ? `${apiBase}/api/${collection}/${documentId}`
        : `${apiBase}/api/${collection}`

      const res = await fetch(url, {
        method: documentId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error("Failed to save")

      const saved = await res.json()

      if (!documentId && saved.id) {
        window.location.href = `/content/${collection}/${saved.id}`
        return
      }

      setSaved(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const renderField = (name: string, fieldDef: FieldDef) => {
    const value = data[name] ?? fieldDef.default ?? ""

    switch (fieldDef.type) {
      case "text":
        return (
          <input
            type="text"
            value={String(value)}
            onChange={(e) => updateField(name, e.target.value)}
            maxLength={fieldDef.maxLength}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        )

      case "slug": {
        const sourceField = fieldDef.from as string | undefined
        const handleAutoGenerate = () => {
          if (sourceField && data[sourceField]) {
            const generated = slugify(String(data[sourceField]))
            updateField(name, generated)
          }
        }

        return (
          <div className="flex gap-2">
            <input
              type="text"
              value={String(value)}
              onChange={(e) => updateField(name, e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={sourceField ? `Auto-generated from ${sourceField}` : ""}
            />
            {sourceField && (
              <button
                type="button"
                onClick={handleAutoGenerate}
                className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                Generate
              </button>
            )}
          </div>
        )
      }

      case "select":
        return (
          <select
            value={String(value)}
            onChange={(e) => updateField(name, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select...</option>
            {(fieldDef.options || []).map((opt: string) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )

      case "number":
        return (
          <input
            type="number"
            value={Number(value) || ""}
            onChange={(e) => updateField(name, Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )

      case "boolean":
        return (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => updateField(name, e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Enabled</span>
          </label>
        )

      case "datetime":
        return (
          <input
            type="datetime-local"
            value={String(value).slice(0, 16)}
            onChange={(e) => updateField(name, new Date(e.target.value).toISOString())}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )

      case "richText": {
        const ptContent = (() => {
          try {
            const raw = value as string
            return raw ? JSON.parse(raw) : undefined
          } catch {
            return undefined
          }
        })()

        return (
          <div className="border border-gray-300 rounded-lg overflow-hidden min-h-[300px]">
            <Suspense fallback={<div className="p-4 text-gray-400 text-sm">Loading editor...</div>}>
              <Editor
                content={ptContent}
                onChange={(blocks) => updateField(name, JSON.stringify(blocks))}
                placeholder="Type / to insert, or just start writing..."
              />
            </Suspense>
          </div>
        )
      }

      default:
        return (
          <input
            type="text"
            value={String(value)}
            onChange={(e) => updateField(name, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )
    }
  }

  const fieldLabel = (name: string) => {
    return name
      .replace(/_/g, " ")
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .trim()
  }

  // Split fields into sidebar (metadata) and main (content)
  const metadataFields = ["status", "slug", "publishedAt", "published_at"]
  const sidebarFields = Object.entries(fields).filter(
    ([name, def]) => metadataFields.includes(name) || def.type === "select" || def.type === "boolean" || def.type === "datetime"
  )
  const mainFields = Object.entries(fields).filter(
    ([name]) => !sidebarFields.some(([sn]) => sn === name)
  )

  return (
    <div className="flex gap-8">
      <div className="flex-1 space-y-6">
        {mainFields.map(([name, def]) => (
          <div key={name}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {fieldLabel(name)}
              {def.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {renderField(name, def)}
          </div>
        ))}
      </div>

      <div className="w-72 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <h3 className="font-medium text-sm text-gray-900">Publish</h3>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-green-600">Saved successfully</p>}

          <div className="flex gap-2">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex-1 py-2 px-3 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex-1 py-2 px-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Publish
            </button>
          </div>
        </div>

        {sidebarFields.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
            <h3 className="font-medium text-sm text-gray-900">Details</h3>
            {sidebarFields.map(([name, def]) => (
              <div key={name}>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {fieldLabel(name)}
                </label>
                {renderField(name, def)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
