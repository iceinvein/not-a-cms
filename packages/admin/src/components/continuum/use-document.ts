import { useCallback, useEffect, useState } from "react"
import { adminApiFetch } from "../../lib/api"
import type { AdminFieldDef } from "../../lib/content-fields"
import { buildPayload } from "../../lib/content-payload"
import { documentSnapshot, isDirty } from "./dirty-state"

function computeInitialData(
  fields: Record<string, AdminFieldDef>,
  initialData?: Record<string, unknown>,
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {}
  for (const [name, def] of Object.entries(fields)) {
    if (def.default !== undefined) defaults[name] = def.default
  }
  return { ...defaults, ...initialData }
}

export type WorkflowAction = "save_draft" | "submit_review" | "publish" | "archive"

/**
 * Whether a "Save" should run a workflow status transition after persisting edits.
 *
 * "Save" (save_draft) only writes the document's fields via PATCH and must leave the
 * publication status untouched: firing the save_draft transition would pull a live,
 * published document back to draft and silently take it off the public site (F-016).
 * Only the explicit Review / Publish / Archive actions change status.
 */
export function shouldRunWorkflowTransition(action: WorkflowAction): boolean {
  return action !== "save_draft"
}

export function useDocument(opts: {
  collection: string
  fields: Record<string, AdminFieldDef>
  apiBase: string
  documentId?: string
  initialData?: Record<string, unknown>
}) {
  const { collection, fields, apiBase, documentId, initialData } = opts

  const [data, setData] = useState<Record<string, unknown>>(() =>
    computeInitialData(fields, initialData),
  )
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(Boolean(documentId && !initialData))
  const [error, setError] = useState<string | null>(null)
  // Baseline snapshot of the last-persisted state. Null until an existing document loads,
  // so a document still being fetched is never reported as having unsaved changes.
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(() =>
    documentId && !initialData
      ? null
      : documentSnapshot(computeInitialData(fields, initialData), fields),
  )

  useEffect(() => {
    if (!documentId || initialData) return

    setLoading(true)
    const populate = Object.entries(fields)
      .filter(([, def]) => def.type === "relation" || def.type === "media")
      .map(([name]) => name)
      .join(",")
    const path = populate
      ? `/api/${collection}/${documentId}?populate=${encodeURIComponent(populate)}`
      : `/api/${collection}/${documentId}`

    adminApiFetch(apiBase, path)
      .then((res) => (res.ok ? res.json() : null))
      .then((doc) => {
        if (doc) {
          setData(doc)
          setSavedSnapshot(documentSnapshot(doc, fields))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [documentId, collection, apiBase, initialData, fields])

  const updateField = useCallback((name: string, value: unknown) => {
    setData((prev) => ({ ...prev, [name]: value }))
  }, [])

  const save = useCallback(
    async (action: WorkflowAction = "save_draft") => {
      setSaving(true)
      setError(null)
      try {
        const url = documentId ? `/api/${collection}/${documentId}` : `/api/${collection}`
        const res = await adminApiFetch(apiBase, url, {
          method: documentId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(data, fields)),
        })

        if (!res.ok) throw new Error("Failed to save")

        let result = await res.json()
        const savedId = String(result.id ?? documentId ?? "")

        if (savedId && shouldRunWorkflowTransition(action)) {
          const workflowRes = await adminApiFetch(
            apiBase,
            `/api/${collection}/${savedId}/workflow`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action }),
            },
          )
          if (!workflowRes.ok) {
            const body = await workflowRes.json().catch(() => null)
            throw new Error(body?.error ?? "Failed to update workflow")
          }
          result = await workflowRes.json()
        }

        if (!documentId && result.id) {
          window.location.href = `/content/${collection}/${result.id}`
          return result
        }

        setData(result)
        setSavedSnapshot(documentSnapshot(result, fields))
        return result
      } catch (err: any) {
        setError(err.message)
        throw err
      } finally {
        setSaving(false)
      }
    },
    [apiBase, collection, documentId, data, fields],
  )

  const dirty = isDirty(savedSnapshot, documentSnapshot(data, fields))

  return { data, setData, updateField, save, saving, loading, error, dirty }
}
