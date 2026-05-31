import { useState, useEffect, lazy, Suspense, useRef, type ChangeEvent } from "react"
import { VersionHistory } from "./VersionHistory"
import { PreviewLink } from "./PreviewLink"
import { ToastProvider, useToast } from "./Toast"
import { ErrorBoundary } from "./ErrorBoundary"
import { adminApiFetch } from "../lib/api"
import {
  addArrayItem,
  coerceArrayValue,
  emptyValueForField,
  formatDateTimeInput,
  parseDateTimeInput,
  prepareValueForField,
  removeArrayItem,
  type AdminFieldDef,
  updateArrayItem,
} from "../lib/content-fields"
import { listMediaItems, mediaDisplayUrl, type AdminMediaItem, uploadMediaFile } from "../lib/media"
import { buildCollaborationConfig, defaultCollabUser } from "../lib/collaboration"
import type { CollabUser } from "@not-a-cms/editor"

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

type Props = {
  collection: string
  collectionLabel: string
  fields: Record<string, AdminFieldDef>
  initialData?: Record<string, unknown>
  documentId?: string
  apiBase?: string
  siteBase?: string
  collaborationUser?: CollabUser
}

type WorkflowAction = "save_draft" | "submit_review" | "publish" | "archive"

const inputClass = "w-full px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-transparent text-[#fafafa] placeholder:text-[#52525b] focus:border-[#c9956b] focus:outline-none focus:ring-0"
const buttonClass = "px-3 py-2 text-xs border border-[rgba(255,255,255,0.1)] text-[#a1a1aa] rounded-lg hover:bg-[rgba(255,255,255,0.03)] transition-colors whitespace-nowrap"

function valueId(value: unknown): string {
  if (!value) return ""
  if (typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string") {
    return (value as { id: string }).id
  }
  return String(value)
}

function labelForDocument(doc: Record<string, unknown>): string {
  return String(doc.title || doc.name || doc.slug || doc.id || "Untitled")
}

function RelationSelect({
  apiBase,
  target,
  value,
  onChange,
}: {
  apiBase: string
  target: string
  value: unknown
  onChange: (value: unknown) => void
}) {
  const [options, setOptions] = useState<Array<Record<string, unknown>>>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const selected = typeof value === "object" && value !== null && "id" in value
    ? value as Record<string, unknown>
    : null

  useEffect(() => {
    if (!target) return
    setLoading(true)
    const params = new URLSearchParams({ limit: "25" })
    if (query.trim()) params.set("search", query.trim())
    adminApiFetch(apiBase, `/api/${encodeURIComponent(target)}?${params.toString()}`)
      .then((res) => res.ok ? res.json() : { data: [] })
      .then((body) => setOptions(Array.isArray(body.data) ? body.data : []))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false))
  }, [apiBase, target, query])

  const renderedOptions = selected && !options.some((doc) => String(doc.id) === String(selected.id))
    ? [selected, ...options]
    : options

  return (
    <div className="space-y-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${target}`}
        className={inputClass}
      />
      <select
        value={valueId(value)}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-[#18181b] text-[#fafafa] focus:border-[#c9956b] focus:outline-none focus:ring-0"
      >
        <option value="">{loading ? `Loading ${target}...` : `Select ${target}`}</option>
        {renderedOptions.map((doc) => (
          <option key={String(doc.id)} value={String(doc.id)}>
            {labelForDocument(doc)}
          </option>
        ))}
      </select>
    </div>
  )
}

function MediaFieldInput({
  apiBase,
  accept,
  value,
  onChange,
}: {
  apiBase: string
  accept?: string[]
  value: unknown
  onChange: (value: unknown) => void
}) {
  const { addToast } = useToast()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AdminMediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectedUrl = mediaDisplayUrl(value, apiBase)

  const loadItems = async () => {
    setLoading(true)
    try {
      setItems(await listMediaItems(apiBase))
    } catch (err: any) {
      addToast(err.message || "Failed to load media", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) loadItems()
  }, [open, apiBase])

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const item = await uploadMediaFile(apiBase, file)
      setItems((prev) => [item, ...prev])
      onChange(item)
      setOpen(false)
    } catch (err: any) {
      addToast(err.message || "Failed to upload media", "error")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-3">
      {selectedUrl ? (
        <div className="flex items-center gap-3 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0a0a0c] p-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-[rgba(255,255,255,0.04)]">
            <img src={selectedUrl} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-[#fafafa]">
              {typeof value === "object" && value && "filename" in value ? String((value as { filename?: unknown }).filename) : "Selected media"}
            </p>
            <p className="truncate text-xs text-[#52525b]">{selectedUrl}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[rgba(255,255,255,0.08)] bg-[#0a0a0c] p-4 text-sm text-[#52525b]">
          No media selected
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setOpen((current) => !current)} className={buttonClass}>
          Select media
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className={buttonClass}>
          {uploading ? "Uploading..." : "Upload"}
        </button>
        {selectedUrl && (
          <button type="button" onClick={() => onChange(null)} className={buttonClass}>
            Clear
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={accept?.join(",")}
          onChange={handleUpload}
          className="hidden"
        />
      </div>

      {open && (
        <div className="max-h-80 overflow-auto rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0a0a0c] p-3">
          {loading ? (
            <p className="text-sm text-[#52525b]">Loading media...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-[#52525b]">No media uploaded yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChange(item)
                    setOpen(false)
                  }}
                  className="overflow-hidden rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#18181b] text-left hover:border-[#c9956b]"
                >
                  <div className="aspect-square bg-[rgba(255,255,255,0.04)]">
                    {item.mimetype.startsWith("image/") ? (
                      <img src={item.url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[#71717a]">File</div>
                    )}
                  </div>
                  <p className="truncate p-2 text-xs text-[#fafafa]">{item.filename}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ContentEditorInner({
  collection,
  fields,
  initialData,
  documentId,
  apiBase = "",
  siteBase = "http://localhost:3000",
  collaborationUser = defaultCollabUser(),
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
  const [loading, setLoading] = useState(Boolean(documentId && !initialData))
  const [versionKey, setVersionKey] = useState(0)
  const publishInputRef = useRef<HTMLInputElement>(null)
  const { addToast } = useToast()

  useEffect(() => {
    if (documentId && !initialData) {
      setLoading(true)
      const populate = Object.entries(fields)
        .filter(([, def]) => def.type === "relation" || def.type === "media")
        .map(([name]) => name)
        .join(",")
      const path = populate
        ? `/api/${collection}/${documentId}?populate=${encodeURIComponent(populate)}`
        : `/api/${collection}/${documentId}`
      adminApiFetch(apiBase, path)
        .then((res) => res.ok ? res.json() : null)
        .then((doc) => { if (doc) setData(doc) })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [documentId, collection, apiBase, initialData])

  const updateField = (name: string, value: unknown) => {
    setData((prev) => ({ ...prev, [name]: value }))
  }

  const publishFieldName = () => {
    if (fields.publishedAt) return "publishedAt"
    if (fields.published_at) return "published_at"
    return null
  }

  const buildPayload = (status?: string) => {
    const payload: Record<string, unknown> = {}
    for (const [name, def] of Object.entries(fields)) {
      if (name === "status") continue
      payload[name] = prepareValueForField(data[name], def)
    }
    if (status !== undefined) payload.status = status
    return payload
  }

  const handleSave = async (workflowAction: WorkflowAction = "save_draft") => {
    setSaving(true)

    try {
      const url = documentId
        ? `/api/${collection}/${documentId}`
        : `/api/${collection}`

      const res = await adminApiFetch(apiBase, url, {
        method: documentId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      })

      if (!res.ok) throw new Error("Failed to save")

      let result = await res.json()
      const savedId = String(result.id ?? documentId ?? "")

      if (savedId && (workflowAction !== "save_draft" || result.status !== "draft")) {
        const workflowRes = await adminApiFetch(apiBase, `/api/${collection}/${savedId}/workflow`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: workflowAction }),
        })
        if (!workflowRes.ok) {
          const body = await workflowRes.json().catch(() => null)
          throw new Error(body?.error ?? "Failed to update workflow")
        }
        result = await workflowRes.json()
      }

      if (!documentId && result.id) {
        window.location.href = `/content/${collection}/${result.id}`
        return
      }

      setData(result)
      addToast(workflowToast(workflowAction), "success")
      setVersionKey(k => k + 1)
    } catch (err: any) {
      addToast(err.message, "error")
    } finally {
      setSaving(false)
    }
  }

  const handleSchedule = async () => {
    const publishField = publishFieldName()
    if (!publishField) {
      addToast("This collection cannot be scheduled", "error")
      return
    }

    const latestInputValue = publishInputRef.current?.value
    const publishedAt = latestInputValue ? parseDateTimeInput(latestInputValue) : data[publishField]
    if (!publishedAt || Number.isNaN(new Date(String(publishedAt)).getTime())) {
      addToast("Choose a valid publish date", "error")
      return
    }

    setSaving(true)
    try {
      if (!documentId) {
        const res = await adminApiFetch(apiBase, `/api/${collection}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload("scheduled")),
        })
        if (!res.ok) throw new Error("Failed to schedule")
        const result = await res.json()
        if (result.id) {
          window.location.href = `/content/${collection}/${result.id}`
          return
        }
        setData(result)
      } else {
        const saveRes = await adminApiFetch(apiBase, `/api/${collection}/${documentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        })
        if (!saveRes.ok) throw new Error("Failed to save")

        const scheduleRes = await adminApiFetch(apiBase, `/api/${collection}/${documentId}/schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [publishField]: publishedAt }),
        })
        if (!scheduleRes.ok) {
          const body = await scheduleRes.json().catch(() => null)
          throw new Error(body?.error ?? "Failed to schedule")
        }
        setData(await scheduleRes.json())
      }
      addToast("Scheduled publish", "success")
      setVersionKey(k => k + 1)
    } catch (err: any) {
      addToast(err.message, "error")
    } finally {
      setSaving(false)
    }
  }

  const workflowToast = (action: WorkflowAction) => {
    switch (action) {
      case "submit_review":
        return "Submitted for review"
      case "publish":
        return "Published successfully"
      case "archive":
        return "Archived successfully"
      default:
        return "Draft saved"
    }
  }

  const handleRestore = (versionData: Record<string, unknown>) => {
    setData(versionData)
    setVersionKey(k => k + 1)
    addToast("Version restored", "success")
  }

  const fieldLabel = (name: string) => {
    return name
      .replace(/_/g, " ")
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .trim()
  }

  const renderField = (
    name: string,
    fieldDef: AdminFieldDef,
    currentValue: unknown = data[name],
    onChange: (value: unknown) => void = (value) => updateField(name, value),
  ) => {
    const value = currentValue ?? fieldDef.default ?? emptyValueForField(fieldDef)

    switch (fieldDef.type) {
      case "text":
        return (
          <input
            type="text"
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            maxLength={fieldDef.maxLength}
            className={inputClass}
          />
        )

      case "slug": {
        const sourceField = fieldDef.from as string | undefined
        const handleAutoGenerate = () => {
          if (sourceField && data[sourceField]) {
            const generated = slugify(String(data[sourceField]))
            onChange(generated)
          }
        }

        return (
          <div className="flex gap-2">
            <input
              type="text"
              value={String(value)}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-transparent text-[#fafafa] placeholder:text-[#52525b] focus:border-[#c9956b] focus:outline-none focus:ring-0"
              placeholder={sourceField ? `Auto-generated from ${sourceField}` : ""}
            />
            {sourceField && (
              <button
                type="button"
                onClick={handleAutoGenerate}
                className={buttonClass}
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
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm bg-[#18181b] text-[#fafafa] focus:border-[#c9956b] focus:outline-none focus:ring-0"
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
            value={value === "" ? "" : Number(value)}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            className={inputClass}
          />
        )

      case "boolean":
        return (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              className="rounded border-[rgba(255,255,255,0.1)]"
            />
            <span className="text-sm text-[#a1a1aa]">Enabled</span>
          </label>
        )

      case "datetime":
        return (
          <input
            ref={name === publishFieldName() ? publishInputRef : undefined}
            type="datetime-local"
            value={formatDateTimeInput(value)}
            onChange={(e) => onChange(parseDateTimeInput(e.target.value))}
            className={inputClass}
          />
        )

      case "media":
        return (
          <MediaFieldInput
            apiBase={apiBase}
            accept={fieldDef.accept}
            value={value}
            onChange={onChange}
          />
        )

      case "relation":
        return (
          <RelationSelect
            apiBase={apiBase}
            target={String(fieldDef.target || "")}
            value={value}
            onChange={onChange}
          />
        )

      case "array": {
        const items = coerceArrayValue(value)
        const itemField = fieldDef.items ?? { type: "text", required: false }

        return (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="flex-1">
                  {renderField(
                    `${name}.${index}`,
                    itemField,
                    item,
                    (itemValue) => onChange(updateArrayItem(items, index, itemValue)),
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onChange(removeArrayItem(items, index))}
                  className={buttonClass}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onChange(addArrayItem(items, itemField))}
              className={buttonClass}
            >
              Add item
            </button>
          </div>
        )
      }

      case "group": {
        const groupValue = typeof value === "object" && value !== null && !Array.isArray(value)
          ? value as Record<string, unknown>
          : {}
        const childFields = fieldDef.fields ?? {}

        return (
          <div className="space-y-4 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0a0a0c] p-4">
            {Object.entries(childFields).map(([childName, childDef]) => (
              <div key={childName}>
                <label className="mb-1 block text-xs font-medium text-[#71717a]">
                  {fieldLabel(childName)}
                  {childDef.required && <span className="text-[#ef4444] ml-1">*</span>}
                </label>
                {renderField(
                  `${name}.${childName}`,
                  childDef,
                  groupValue[childName],
                  (childValue) => onChange({ ...groupValue, [childName]: childValue }),
                )}
              </div>
            ))}
          </div>
        )
      }

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
                onChange={(layout) => onChange(JSON.stringify(layout))}
                apiBase={apiBase}
              />
            </Suspense>
          </div>
        )
      }

      case "richText": {
        const collaboration = buildCollaborationConfig({
          apiBase,
          collection,
          documentId,
          fieldName: name,
          user: collaborationUser,
        })
        const ptContent = portableTextValue(value)
        const editorCollaboration = ptContent && ptContent.length > 0 ? null : collaboration

        return (
          <div className="rounded-lg min-h-[300px] [&_.ProseMirror]:text-[#fafafa] [&_.ProseMirror]:bg-transparent [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[250px] [&_.ProseMirror]:px-4 [&_.ProseMirror]:py-3 [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-[#52525b] [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 border border-[rgba(255,255,255,0.08)] focus-within:border-[rgba(255,255,255,0.15)] transition-colors bg-[#0a0a0c]">
            {editorCollaboration && (
              <div className="border-b border-[rgba(255,255,255,0.06)] px-4 py-2 text-xs text-[#71717a]">
                <span>Live editing</span>
              </div>
            )}
            <Suspense fallback={<div className="p-4 text-[#52525b] text-sm">Loading editor...</div>}>
              <Editor
                content={ptContent}
                onChange={(blocks) => onChange(JSON.stringify(blocks))}
                placeholder="Type / to insert, or just start writing..."
                collaboration={editorCollaboration ?? undefined}
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
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          />
        )
    }
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
          <h3 className="font-medium text-sm text-[#fafafa]">Workflow</h3>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleSave("save_draft")}
              disabled={saving}
              className="py-2 px-3 border border-[rgba(255,255,255,0.06)] text-[#a1a1aa] rounded-lg text-sm font-medium hover:bg-[rgba(255,255,255,0.03)] disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              onClick={() => handleSave("submit_review")}
              disabled={saving}
              className="py-2 px-3 border border-[rgba(255,255,255,0.06)] text-[#a1a1aa] rounded-lg text-sm font-medium hover:bg-[rgba(255,255,255,0.03)] disabled:opacity-50 transition-colors"
            >
              Submit Review
            </button>
            <button
              onClick={() => handleSave("publish")}
              disabled={saving}
              className="py-2 px-3 bg-[#c9956b] text-[#0a0a0c] rounded-lg text-sm font-medium hover:bg-[#d4a57c] disabled:opacity-50 transition-colors"
            >
              Publish
            </button>
            <button
              onClick={handleSchedule}
              disabled={saving || !publishFieldName()}
              className="py-2 px-3 border border-[rgba(201,149,107,0.35)] text-[#c9956b] rounded-lg text-sm font-medium hover:bg-[rgba(201,149,107,0.08)] disabled:opacity-50 transition-colors"
            >
              Schedule
            </button>
            <button
              onClick={() => handleSave("archive")}
              disabled={saving}
              className="py-2 px-3 border border-[rgba(245,158,11,0.2)] text-[#f59e0b] rounded-lg text-sm font-medium hover:bg-[rgba(245,158,11,0.06)] disabled:opacity-50 transition-colors"
            >
              Archive
            </button>
          </div>
          {publishFieldName() && (
            <p className="text-xs text-[#71717a]">Schedule publish</p>
          )}
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
            <PreviewLink collection={collection} documentId={documentId} apiBase={apiBase} siteBase={siteBase} />
          </div>
        )}
      </div>
    </div>
  )
}

export function portableTextValue(value: unknown): any[] | undefined {
  if (Array.isArray(value)) return value
  if (typeof value !== "string" || !value.trim()) return undefined
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
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
