import type { AdminFieldDef } from "../../lib/content-fields"
import { panelFields } from "../../lib/content-fields"
import { FieldRow, humanizeFieldName } from "./InspectorFields"

export { humanizeFieldName }

type Props = {
  fields: Record<string, AdminFieldDef>
  data: Record<string, unknown>
  updateField: (name: string, value: unknown) => void
  exclude?: string[]
  apiBase?: string
}

/**
 * Side panel that exposes a document's metadata fields (slug, tags, dates, relations,
 * media, etc.) so they can be edited in the admin. The rich text body and any
 * caller-handled fields (title, status) are excluded.
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
