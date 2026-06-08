import { useCallback, useEffect, useRef, useState } from "react"
import type { AdminFieldDef } from "../../lib/content-fields"
import {
  addArrayItem,
  coerceArrayValue,
  formatDateTimeInput,
  panelFields,
  parseDateTimeInput,
  removeArrayItem,
  updateArrayItem,
} from "../../lib/content-fields"
import { adminApiFetch } from "../../lib/api"
import { listMediaItems, mediaDisplayUrl, uploadMediaFile, type AdminMediaItem } from "../../lib/media"
import { Select } from "../ui/Select"
import { Checkbox } from "../ui/Checkbox"

type Props = {
  fields: Record<string, AdminFieldDef>
  data: Record<string, unknown>
  updateField: (name: string, value: unknown) => void
  exclude?: string[]
  apiBase?: string
}

export function humanizeFieldName(name: string): string {
  const spaced = name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * Side panel that exposes a document's metadata fields (slug, tags, dates,
 * relations, media, etc.) so they can be edited in the admin. The rich text
 * body and any caller-handled fields (title, status) are excluded.
 */
export function FieldsPanel({ fields, data, updateField, exclude = [], apiBase = "" }: Props) {
  const entries = panelFields(fields, exclude)
  if (entries.length === 0) return null
  return (
    <aside className="cn-fields" aria-label="Document fields">
      <p className="cn-fields-title">Fields</p>
      {entries.map(([name, def]) => (
        <FieldRow
          key={name}
          fieldName={name}
          def={def}
          value={data[name]}
          apiBase={apiBase}
          onChange={(value) => updateField(name, value)}
        />
      ))}
    </aside>
  )
}

type RowProps = {
  fieldName: string
  def: AdminFieldDef
  value: unknown
  apiBase: string
  onChange: (value: unknown) => void
}

function FieldRow({ fieldName, def, value, apiBase, onChange }: RowProps) {
  const label = humanizeFieldName(fieldName)
  const id = `cn-field-${fieldName}`
  return (
    <label className="cn-field" htmlFor={id}>
      <span className="cn-field-label">{label}</span>
      <FieldControl id={id} def={def} value={value} apiBase={apiBase} onChange={onChange} />
    </label>
  )
}

function FieldControl({ id, def, value, apiBase, onChange }: { id: string } & Omit<RowProps, "fieldName">) {
  switch (def.type) {
    case "boolean":
      return (
        <Checkbox
          id={id}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked)}
        />
      )
    case "number":
      return (
        <input
          id={id}
          type="number"
          className="cn-field-input"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      )
    case "datetime":
      return (
        <input
          id={id}
          type="datetime-local"
          className="cn-field-input"
          value={formatDateTimeInput(value)}
          onChange={(e) => onChange(parseDateTimeInput(e.target.value))}
        />
      )
    case "select":
      return (
        <Select
          id={id}
          value={String(value ?? "")}
          onValueChange={(next) => onChange(next)}
          placeholder="—"
          options={[
            { value: "", label: "—" },
            ...(def.options ?? []).map((opt) => ({ value: opt, label: humanizeFieldName(opt) })),
          ]}
        />
      )
    case "array":
      return <ArrayField id={id} def={def} value={value} onChange={onChange} />
    case "relation":
      return <RelationField id={id} def={def} value={value} apiBase={apiBase} onChange={onChange} />
    case "media":
      return <MediaField id={id} value={value} apiBase={apiBase} onChange={onChange} />
    case "text":
      if (def.multiline) {
        return (
          <textarea
            id={id}
            className="cn-field-input cn-field-textarea"
            rows={3}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
          />
        )
      }
    // falls through to the default single-line input
    // eslint-disable-next-line no-fallthrough
    default:
      return (
        <input
          id={id}
          type="text"
          className="cn-field-input"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}

function ArrayField({ id, def, value, onChange }: { id: string; def: AdminFieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const items = coerceArrayValue(value)
  const itemField = def.items ?? { type: "text" }
  return (
    <span className="cn-field-array">
      {items.map((item, index) => (
        <span key={index} className="cn-field-array-row">
          <input
            id={index === 0 ? id : undefined}
            type="text"
            className="cn-field-input"
            value={String(item ?? "")}
            onChange={(e) => onChange(updateArrayItem(items, index, e.target.value))}
          />
          <button type="button" className="cn-field-remove" aria-label="Remove" onClick={() => onChange(removeArrayItem(items, index))}>
            ×
          </button>
        </span>
      ))}
      <button type="button" className="cn-field-add" onClick={() => onChange(addArrayItem(items, itemField))}>
        + Add
      </button>
    </span>
  )
}

function RelationField({ id, def, value, apiBase, onChange }: { id: string; def: AdminFieldDef; value: unknown; apiBase: string; onChange: (v: unknown) => void }) {
  const [options, setOptions] = useState<Array<{ id: string; label: string }>>([])
  const target = def.target

  useEffect(() => {
    if (!target) return
    let active = true
    adminApiFetch(apiBase, `/api/${target}?limit=100`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body: { data?: Array<Record<string, unknown>> }) => {
        if (!active) return
        setOptions(
          (body.data ?? []).map((item) => ({
            id: String(item.id),
            label: String(item.title ?? item.name ?? item.slug ?? item.id),
          })),
        )
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [target, apiBase])

  return (
    <Select
      id={id}
      value={mediaId(value)}
      onValueChange={(next) => onChange(next === "" ? null : next)}
      placeholder="—"
      options={[{ value: "", label: "—" }, ...options.map((opt) => ({ value: opt.id, label: opt.label }))]}
    />
  )
}

/**
 * Media field control: a real Vault picker instead of a bare "Asset id" text box
 * (F-014). Shows a thumbnail of the current selection, a "Choose from Vault" picker
 * listing existing assets, an inline upload, and a clear control.
 */
function MediaField({ id, value, apiBase, onChange }: { id: string; value: unknown; apiBase: string; onChange: (v: unknown) => void }) {
  const selectedId = mediaId(value)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AdminMediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadItems = useCallback(() => {
    setLoading(true)
    setError(null)
    listMediaItems(apiBase)
      .then(setItems)
      .catch(() => setError("Failed to load media"))
      .finally(() => setLoading(false))
  }, [apiBase])

  function openPicker() {
    setOpen(true)
    if (items.length === 0) loadItems()
  }

  async function handleUpload(file: File) {
    setUploading(true)
    setError(null)
    try {
      const item = await uploadMediaFile(apiBase, file)
      setItems((prev) => [item, ...prev])
      onChange(item.id)
    } catch {
      setError("Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const previewUrl = selectedId ? mediaDisplayUrl({ id: selectedId }, apiBase) : ""

  return (
    <div className="cn-media" id={id}>
      {selectedId ? (
        <div className="cn-media-selected">
          <img className="cn-media-thumb" src={previewUrl} alt="" />
          <span className="cn-media-name">{selectedId}</span>
          <button type="button" className="cn-field-remove" aria-label="Remove image" onClick={() => onChange(null)}>
            ×
          </button>
        </div>
      ) : (
        <p className="cn-media-empty">No image selected.</p>
      )}

      <div className="cn-media-actions">
        <button type="button" className="cn-media-btn" onClick={openPicker}>
          {selectedId ? "Replace" : "Choose from Vault"}
        </button>
        <button type="button" className="cn-media-btn" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? "Uploading…" : "Upload"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleUpload(file)
            e.target.value = ""
          }}
        />
      </div>

      {error && <p className="cn-media-error">{error}</p>}

      {open && (
        <div className="cn-media-picker" role="dialog" aria-label="Choose media">
          <div className="cn-media-picker-head">
            <span>Choose an image</span>
            <button type="button" className="cn-field-remove" aria-label="Close picker" onClick={() => setOpen(false)}>
              ×
            </button>
          </div>
          {loading ? (
            <p className="cn-media-empty">Loading…</p>
          ) : items.length === 0 ? (
            <p className="cn-media-empty">No media yet. Upload one above.</p>
          ) : (
            <div className="cn-media-grid">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`cn-media-tile${item.id === selectedId ? " is-selected" : ""}`}
                  title={item.filename}
                  onClick={() => {
                    onChange(item.id)
                    setOpen(false)
                  }}
                >
                  <img src={mediaDisplayUrl({ id: item.id }, apiBase)} alt={item.alt || item.filename} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function mediaId(value: unknown): string {
  if (value && typeof value === "object" && "id" in value) return String((value as { id: unknown }).id)
  return value === null || value === undefined ? "" : String(value)
}
