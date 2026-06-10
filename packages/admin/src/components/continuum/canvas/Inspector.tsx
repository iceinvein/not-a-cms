// packages/admin/src/components/continuum/canvas/Inspector.tsx
import type { BlockFieldDef } from "@not-a-cms/editor"
import type { ComponentType } from "react"

/** Minimal structural type covering the editor API the Inspector actually calls. */
type TiptapEditor = {
  state: {
    doc: {
      nodeAt: (pos: number) => { type: { name: string }; attrs: Record<string, unknown> } | null
    }
  }
  chain: () => {
    command: (fn: (opts: { tr: { setNodeMarkup: (pos: number, type: undefined, attrs: Record<string, unknown>) => void } }) => boolean) => { run: () => boolean }
  }
}
import { coerceArrayValue, emptyValueForField } from "../../../lib/content-fields"
import { blockSpecs } from "../blocks/specs"
import { MediaPicker } from "../blocks/media-picker"
import { FieldRow, humanizeFieldName } from "../InspectorFields"
import type { CanvasSelection } from "./selection"
import { LogosControl } from "./inspector-controls/LogosControl"

/**
 * Per-block custom controls for object-array fields whose per-item settings are richer than
 * generic add/remove (their item text is edited inline on the canvas; this edits the rest).
 * Keyed by `${blockName}:${fieldKey}`. Registered by the blocks that need them.
 */
export type ArrayControlProps = {
  value: unknown
  onChange: (next: unknown[]) => void
  apiBase: string
}
export const CUSTOM_ARRAY_CONTROLS: Record<string, ComponentType<ArrayControlProps>> = {}
CUSTOM_ARRAY_CONTROLS["logoCloud:logos"] = LogosControl

type Props = {
  editor: TiptapEditor | null
  selected: CanvasSelection
  apiBase?: string
}

/**
 * Right-rail inspector for the selected section. Reads the block's spec to split fields
 * into inline (edited on the canvas, hidden here) and non-inline (edited here). Scalar
 * fields render through the shared FieldRow; object-array fields render an add/remove
 * structure control (their per-item text is edited inline on the canvas). All writes go
 * through a setNodeMarkup transaction at the selected position, so the inspector and the
 * inline holes always read/write the same node.
 */
export function Inspector({ editor, selected, apiBase = "" }: Props) {
  if (!editor || !selected) {
    return (
      <aside className="cn-inspector" aria-label="Section settings">
        <p className="cn-inspector-empty">Select a section to edit its settings.</p>
      </aside>
    )
  }

  const spec = blockSpecs.find((s) => s.name === selected.name)
  const node = editor.state.doc.nodeAt(selected.pos)
  if (!spec || !node) {
    return (
      <aside className="cn-inspector" aria-label="Section settings">
        <p className="cn-inspector-empty">Select a section to edit its settings.</p>
      </aside>
    )
  }

  const attrs = node.attrs as Record<string, unknown>
  const inline = new Set(spec.inlineText ?? [])

  const setAttr = (key: string, value: unknown) => {
    editor
      .chain()
      .command(({ tr }: { tr: { setNodeMarkup: (pos: number, type: undefined, attrs: Record<string, unknown>) => void } }) => {
        tr.setNodeMarkup(selected.pos, undefined, { ...attrs, [key]: value })
        return true
      })
      .run()
  }

  const fields = Object.entries(spec.schema).filter(([key]) => !inline.has(key))
  const mediaFields = new Set(spec.mediaFields ?? [])

  return (
    <aside className="cn-inspector" aria-label="Section settings">
      <p className="cn-inspector-title">{humanizeFieldName(spec.name)}</p>
      {fields.map(([key, def]) => {
        if (mediaFields.has(key)) {
          return (
            <div key={key} className="cn-field">
              <span className="cn-field-label">{humanizeFieldName(key)}</span>
              <MediaPicker
                value={String(attrs[key] ?? "")}
                chooseLabel={`Choose ${humanizeFieldName(key).toLowerCase()}`}
                onSelect={(item) => setAttr(key, item.url)}
                onClear={() => setAttr(key, "")}
              />
            </div>
          )
        }
        if (def.type === "array") {
          const Custom = CUSTOM_ARRAY_CONTROLS[`${spec.name}:${key}`]
          if (Custom) {
            return <Custom key={key} value={attrs[key]} onChange={(next) => setAttr(key, next)} apiBase={apiBase} />
          }
          return (
            <ArrayStructure
              key={key}
              fieldKey={key}
              def={def}
              value={attrs[key]}
              onChange={(next) => setAttr(key, next)}
            />
          )
        }
        return (
          <FieldRow
            key={key}
            fieldName={key}
            def={def}
            value={attrs[key]}
            apiBase={apiBase}
            onChange={(value) => setAttr(key, value)}
          />
        )
      })}
    </aside>
  )
}

/**
 * Add/remove control for an object-array field. The item's text fields are edited inline
 * on the canvas, so this only manages how many items exist and their order is implicit by
 * index. New items are created from the array's item-field defaults.
 */
function ArrayStructure({
  fieldKey,
  def,
  value,
  onChange,
}: {
  fieldKey: string
  def: BlockFieldDef
  value: unknown
  onChange: (next: unknown[]) => void
}) {
  const items = coerceArrayValue(value)
  const itemTemplate = (def as { items?: unknown }).items ?? { type: "group", fields: {} }
  return (
    <div className="cn-inspector-array">
      <span className="cn-field-label">{humanizeFieldName(fieldKey)}</span>
      <ol className="cn-inspector-array-list">
        {items.map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: positional rows with no stable id; the editable text lives on the canvas, this only adds/removes by position
          <li key={index} className="cn-inspector-array-row">
            <span>Item {index + 1}</span>
            <button
              type="button"
              className="cn-field-remove"
              aria-label={`Remove item ${index + 1}`}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              ×
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="cn-field-add"
        onClick={() => onChange([...items, emptyValueForField(itemTemplate as any)])}
      >
        + Add item
      </button>
    </div>
  )
}
