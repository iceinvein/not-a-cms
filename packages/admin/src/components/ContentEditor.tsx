import { useState, useEffect, lazy, Suspense } from "react"
import { VersionHistory } from "./VersionHistory"
import { PreviewLink } from "./PreviewLink"
import { ToastProvider, useToast } from "./Toast"
import { ErrorBoundary } from "./ErrorBoundary"

// Lazy imports to avoid Vite resolving bun:sqlite through dependency chains
const Editor = lazy(() => import("@not-a-cms/editor").then(m => ({ default: m.Editor })))
const PageBuilder = lazy(() => import("./builder/PageBuilder").then(m => ({ default: m.PageBuilder })))

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

function ContentEditorInner({
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
  const [loading, setLoading] = useState(!!documentId)
  const [versionKey, setVersionKey] = useState(0)
  const { addToast } = useToast()

  useEffect(() => {
    if (documentId) {
      setLoading(true)
      fetch(`${apiBase}/api/${collection}/${documentId}`)
        .then((res) => res.ok ? res.json() : null)
        .then((doc) => { if (doc) setData(doc) })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [documentId, collection, apiBase])

  const updateField = (name: string, value: unknown) => {
    setData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = async (publish = false) => {
    setSaving(true)

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

      const result = await res.json()

      if (!documentId && result.id) {
        window.location.href = `/content/${collection}/${result.id}`
        return
      }

      setData(result)
      addToast("Saved successfully", "success")
      setVersionKey(k => k + 1)
    } catch (err: any) {
      addToast(err.message, "error")
    } finally {
      setSaving(false)
    }
  }

  const handleRestore = (versionData: Record<string, unknown>) => {
    setData(versionData)
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
            className="w-full px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-transparent text-[#fafafa] placeholder:text-[#52525b] focus:border-[rgba(255,255,255,0.2)] focus:outline-none focus:ring-0"
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
              className="flex-1 px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-transparent text-[#fafafa] placeholder:text-[#52525b] focus:border-[rgba(255,255,255,0.2)] focus:outline-none focus:ring-0"
              placeholder={sourceField ? `Auto-generated from ${sourceField}` : ""}
            />
            {sourceField && (
              <button
                type="button"
                onClick={handleAutoGenerate}
                className="px-3 py-2 text-xs border border-[rgba(255,255,255,0.1)] text-[#a1a1aa] rounded-lg hover:bg-[rgba(255,255,255,0.03)] transition-colors whitespace-nowrap"
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
            className="w-full px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-[#18181b] text-[#fafafa] focus:border-[rgba(255,255,255,0.2)] focus:outline-none focus:ring-0"
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
            className="w-full px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-transparent text-[#fafafa] placeholder:text-[#52525b] focus:border-[rgba(255,255,255,0.2)] focus:outline-none focus:ring-0"
          />
        )

      case "boolean":
        return (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => updateField(name, e.target.checked)}
              className="rounded border-[rgba(255,255,255,0.1)]"
            />
            <span className="text-sm text-[#a1a1aa]">Enabled</span>
          </label>
        )

      case "datetime":
        return (
          <input
            type="datetime-local"
            value={String(value).slice(0, 16)}
            onChange={(e) => updateField(name, new Date(e.target.value).toISOString())}
            className="w-full px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-transparent text-[#fafafa] placeholder:text-[#52525b] focus:border-[rgba(255,255,255,0.2)] focus:outline-none focus:ring-0"
          />
        )

      case "pageLayout": {
        const layoutValue = (() => {
          try {
            const raw = value as string
            return raw ? JSON.parse(raw) : undefined
          } catch {
            return undefined
          }
        })()

        return (
          <div style={{ minHeight: "600px" }}>
            <Suspense fallback={<div className="p-4 text-[#52525b] text-sm">Loading page builder...</div>}>
              <PageBuilder
                initialLayout={layoutValue}
                onChange={(layout) => updateField(name, JSON.stringify(layout))}
                apiBase={apiBase}
              />
            </Suspense>
          </div>
        )
      }

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
          <div className="rounded-lg min-h-[300px] [&_.ProseMirror]:text-[#fafafa] [&_.ProseMirror]:bg-transparent [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[250px] [&_.ProseMirror]:px-4 [&_.ProseMirror]:py-3 [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-[#52525b] [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 border border-[rgba(255,255,255,0.08)] focus-within:border-[rgba(255,255,255,0.15)] transition-colors bg-[#0a0a0c]">
            <Suspense fallback={<div className="p-4 text-[#52525b] text-sm">Loading editor...</div>}>
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
            className="w-full px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-transparent text-[#fafafa] placeholder:text-[#52525b] focus:border-[rgba(255,255,255,0.2)] focus:outline-none focus:ring-0"
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-[#52525b]">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex gap-8">
      <div className="flex-1 space-y-6">
        {mainFields.map(([name, def]) => (
          <div key={name}>
            <label className="block text-sm font-medium text-[#a1a1aa] mb-1">
              {fieldLabel(name)}
              {def.required && <span className="text-[#ef4444] ml-1">*</span>}
            </label>
            {renderField(name, def)}
          </div>
        ))}
      </div>

      <div className="w-72 space-y-6">
        <div className="bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] p-4 space-y-4">
          <h3 className="font-medium text-sm text-[#fafafa]">Publish</h3>

          <div className="flex gap-2">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex-1 py-2 px-3 border border-[rgba(255,255,255,0.06)] text-[#a1a1aa] rounded-lg text-sm font-medium hover:bg-[rgba(255,255,255,0.03)] disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex-1 py-2 px-3 bg-[#fafafa] text-[#0a0a0c] rounded-lg text-sm font-medium hover:bg-[#e4e4e7] disabled:opacity-50 transition-colors"
            >
              Publish
            </button>
          </div>
        </div>

        {sidebarFields.length > 0 && (
          <div className="bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] p-4 space-y-4">
            <h3 className="font-medium text-sm text-[#fafafa]">Details</h3>
            {sidebarFields.map(([name, def]) => (
              <div key={name}>
                <label className="block text-xs font-medium text-[#71717a] mb-1">
                  {fieldLabel(name)}
                </label>
                {renderField(name, def)}
              </div>
            ))}
          </div>
        )}

        {documentId && (
          <div className="bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] p-4 space-y-2">
            <h3 className="font-medium text-sm text-[#fafafa]">Version History</h3>
            <VersionHistory
              key={versionKey}
              collection={collection}
              documentId={documentId}
              apiBase={apiBase}
              onRestore={handleRestore}
            />
          </div>
        )}

        {documentId && (
          <div className="bg-[#18181b] rounded-xl border border-[rgba(255,255,255,0.06)] p-4 space-y-2">
            <h3 className="font-medium text-sm text-[#fafafa]">Preview</h3>
            <PreviewLink collection={collection} documentId={documentId} apiBase={apiBase} />
          </div>
        )}
      </div>
    </div>
  )
}

export function ContentEditor(props: Props) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ContentEditorInner {...props} />
      </ToastProvider>
    </ErrorBoundary>
  )
}
