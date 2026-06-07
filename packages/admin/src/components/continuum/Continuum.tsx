import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react"
import { ErrorBoundary } from "../ErrorBoundary"
import { ToastProvider, useToast } from "../Toast"
import { portableTextValue } from "../../lib/portable-text-value"
import { buildCollaborationConfig, defaultCollabUser } from "../../lib/collaboration"
import type { AdminFieldDef } from "../../lib/content-fields"
import type { CollabUser } from "@not-a-cms/editor"
import { ChannelMirror } from "./ChannelMirror"
import { continuumBlocks, continuumSlashCommands } from "./blocks"
import { useDocument, type WorkflowAction } from "./use-document"

const Editor = lazy(() => import("@not-a-cms/editor").then((module) => ({ default: module.Editor })))

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

function richTextFieldName(fields: Record<string, AdminFieldDef>): string | null {
  const entry = Object.entries(fields).find(([, def]) => def.type === "richText")
  return entry ? entry[0] : null
}

function titleFieldName(fields: Record<string, AdminFieldDef>): string {
  if (fields.title) return "title"
  const entry = Object.entries(fields).find(([, def]) => def.type === "text" || def.type === "slug")
  return entry?.[0] ?? "title"
}

export function shouldEnableContinuumCollaboration(input: {
  documentId?: string
  initialBlockCount: number | null
  currentBlockCount: number
}): boolean {
  return Boolean(input.documentId) && input.initialBlockCount === 0
}

function workflowToast(action: WorkflowAction): string {
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

function ContinuumInner({
  collection,
  collectionLabel,
  fields,
  initialData,
  documentId,
  apiBase = "",
  siteBase = "http://localhost:3000",
  collaborationUser = defaultCollabUser(),
}: Props) {
  const { addToast } = useToast()
  const { data, updateField, save, saving, loading, error } = useDocument({
    collection,
    fields,
    apiBase,
    documentId,
    initialData,
  })
  const titleField = titleFieldName(fields)
  const bodyField = richTextFieldName(fields)
  const parsedBodyBlocks = bodyField ? portableTextValue(data[bodyField]) ?? [] : []
  const [bodyBlocks, setBodyBlocks] = useState<any[]>(parsedBodyBlocks)
  const collaborationBaseline = useRef<{ key: string; blockCount: number } | null>(null)
  const collaborationKey = `${documentId ?? "new"}:${bodyField ?? ""}`

  useEffect(() => {
    const next = bodyField ? portableTextValue(data[bodyField]) ?? [] : []
    setBodyBlocks((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next))
  }, [bodyField, data])

  useEffect(() => {
    if (loading || !bodyField) return
    if (collaborationBaseline.current?.key !== collaborationKey) {
      collaborationBaseline.current = { key: collaborationKey, blockCount: parsedBodyBlocks.length }
    }
  }, [loading, bodyField, collaborationKey, parsedBodyBlocks.length])

  const initialCollaborationBlockCount = collaborationBaseline.current?.key === collaborationKey
    ? collaborationBaseline.current.blockCount
    : loading
      ? null
      : parsedBodyBlocks.length

  const collaboration = useMemo(() => {
    if (!bodyField) return null
    if (!shouldEnableContinuumCollaboration({
      documentId,
      initialBlockCount: initialCollaborationBlockCount,
      currentBlockCount: bodyBlocks.length,
    })) {
      return null
    }
    const cfg = buildCollaborationConfig({
      apiBase,
      collection,
      documentId,
      fieldName: bodyField,
      user: collaborationUser,
    })
    return cfg
  }, [apiBase, collection, documentId, bodyField, collaborationUser, initialCollaborationBlockCount, bodyBlocks.length])

  const handleSave = async (action: WorkflowAction) => {
    try {
      await save(action)
      addToast(workflowToast(action), "success")
    } catch (err: any) {
      addToast(err.message || "Failed to save", "error")
    }
  }

  const title = String(data[titleField] ?? "")
  const titleRef = useRef<HTMLTextAreaElement>(null)
  // Auto-grow the title so long titles wrap instead of clipping at the canvas edge.
  // Declared before the loading guard so hook order stays stable across renders.
  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [title])

  if (loading) {
    return <div className="cn-loading">Loading document...</div>
  }

  const byline = String((data.author as any)?.name ?? data.author ?? "")
  const statusLabel = String(data.status ?? "draft").replace(/_/g, " ")

  return (
    <div className="cn-root" data-site-base={siteBase}>
      <main className="cn-canvas">
        <section className="cn-sheet" aria-label={`${collectionLabel} document`}>
          <div className="cn-sheet-head">
            <div className="cn-meta">
              <span>{collectionLabel}</span>
              <span>{saving ? "Saving..." : error ? "Needs attention" : statusLabel}</span>
            </div>
            <div className="cn-presence" aria-label="Current collaborator">
              <span style={{ background: collaborationUser.color }} aria-hidden="true" />
              {collaborationUser.name}
            </div>
          </div>
          <textarea
            ref={titleRef}
            className="cn-title"
            value={title}
            placeholder="Untitled"
            rows={1}
            onChange={(event) => updateField(titleField, event.target.value)}
          />
          {bodyField ? (
            <Suspense fallback={<div className="cn-loading">Loading editor...</div>}>
              <Editor
                content={portableTextValue(data[bodyField])}
                blocks={continuumBlocks}
                slashCommands={continuumSlashCommands}
                placeholder="Type / to insert, or just start writing..."
                collaboration={collaboration ?? undefined}
                onChange={(blocks) => {
                  setBodyBlocks(blocks)
                  updateField(bodyField, JSON.stringify(blocks))
                }}
              />
            </Suspense>
          ) : (
            <div className="cn-empty">This collection has no rich text field.</div>
          )}
        </section>
      </main>

      <ChannelMirror apiBase={apiBase} blocks={bodyBlocks} title={title || "Untitled"} byline={byline} />

      <div className="cn-status">
        <span className="cn-status-state">{saving ? "Saving..." : error || statusLabel}</span>
        <button className="cn-status-btn" type="button" disabled={saving} onClick={() => handleSave("save_draft")}>
          Save
        </button>
        <button className="cn-status-btn" type="button" disabled={saving} onClick={() => handleSave("submit_review")}>
          Review
        </button>
        <button className="cn-status-publish" type="button" disabled={saving} onClick={() => handleSave("publish")}>
          <kbd>⌘↵</kbd> publish
        </button>
      </div>
    </div>
  )
}

export function Continuum(props: Props) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ContinuumInner {...props} />
      </ToastProvider>
    </ErrorBoundary>
  )
}
