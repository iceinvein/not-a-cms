import type { CollabUser } from "@not-a-cms/editor"
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react"
import { adminApiFetch } from "../../lib/api"
import { buildCollaborationConfig, defaultCollabUser } from "../../lib/collaboration"
import type { AdminFieldDef } from "../../lib/content-fields"
import { portableTextValue } from "../../lib/portable-text-value"
import { ErrorBoundary } from "../ErrorBoundary"
import { ToastProvider, useToast } from "../Toast"
import { ConfirmDialog } from "../ui/ConfirmDialog"
import { continuumBlocks, continuumSlashCommands } from "./blocks"
import { ChannelMirror } from "./ChannelMirror"
import { VisualCanvas } from "./canvas/VisualCanvas"
import { saveState, saveStateLabel } from "./dirty-state"
import { FieldsPanel } from "./FieldsPanel"
import { liveUrlForDocument, type SiteRoute } from "./live-url"
import { type ConfirmContent, publishActionConfirm } from "./publish-confirm"
import { useDocument, type WorkflowAction } from "./use-document"

const Editor = lazy(() =>
  import("@not-a-cms/editor").then((module) => ({ default: module.Editor })),
)

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
  const [editorMode, setEditorMode] = useState<"document" | "visual">("document")
  const [routes, setRoutes] = useState<SiteRoute[] | null>(null)
  const [confirm, setConfirm] = useState<{
    action: WorkflowAction
    content: ConfirmContent
  } | null>(null)
  const { data, updateField, save, saving, loading, error, dirty } = useDocument({
    collection,
    fields,
    apiBase,
    documentId,
    initialData,
  })

  // The site's public route table, used to build the "View live" link after publishing.
  // Best-effort: if it can't load, publishing simply omits the link rather than guessing.
  useEffect(() => {
    let cancelled = false
    adminApiFetch(apiBase, "/api/_site")
      .then((res) => (res.ok ? res.json() : null))
      .then((site) => {
        if (!cancelled) setRoutes(Array.isArray(site?.routes) ? site.routes : null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [apiBase])
  const titleField = titleFieldName(fields)
  const bodyField = richTextFieldName(fields)
  const parsedBodyBlocks = bodyField ? (portableTextValue(data[bodyField]) ?? []) : []
  const [bodyBlocks, setBodyBlocks] = useState<any[]>(parsedBodyBlocks)
  const collaborationBaseline = useRef<{ key: string; blockCount: number } | null>(null)
  const collaborationKey = `${documentId ?? "new"}:${bodyField ?? ""}`

  useEffect(() => {
    const next = bodyField ? (portableTextValue(data[bodyField]) ?? []) : []
    setBodyBlocks((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next))
  }, [bodyField, data])

  useEffect(() => {
    if (loading || !bodyField) return
    if (collaborationBaseline.current?.key !== collaborationKey) {
      collaborationBaseline.current = { key: collaborationKey, blockCount: parsedBodyBlocks.length }
    }
  }, [loading, bodyField, collaborationKey, parsedBodyBlocks.length])

  const initialCollaborationBlockCount =
    collaborationBaseline.current?.key === collaborationKey
      ? collaborationBaseline.current.blockCount
      : loading
        ? null
        : parsedBodyBlocks.length

  const collaboration = useMemo(() => {
    if (!bodyField) return null
    if (
      !shouldEnableContinuumCollaboration({
        documentId,
        initialBlockCount: initialCollaborationBlockCount,
        currentBlockCount: bodyBlocks.length,
      })
    ) {
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
  }, [
    apiBase,
    collection,
    documentId,
    bodyField,
    collaborationUser,
    initialCollaborationBlockCount,
    bodyBlocks.length,
  ])

  const title = String(data[titleField] ?? "")

  const handleSave = async (action: WorkflowAction) => {
    try {
      const result = await save(action)
      const liveUrl =
        action === "publish"
          ? liveUrlForDocument({ routes, collection, doc: result ?? data, siteBase })
          : null
      addToast(
        workflowToast(action),
        "success",
        liveUrl ? { label: "View live", href: liveUrl } : undefined,
      )
    } catch (err: any) {
      addToast(err.message || "Failed to save", "error")
    }
  }

  // Publish and Archive change what the public site shows, so they confirm the consequence
  // first (publishActionConfirm names it). Save and Review stay frictionless (null content).
  const requestAction = (action: WorkflowAction) => {
    const content = publishActionConfirm(action, title)
    if (content) {
      setConfirm({ action, content })
    } else {
      void handleSave(action)
    }
  }

  // ⌘↵ / Ctrl+↵ opens the guarded publish flow, matching the keyboard hint on the button.
  // It only opens the confirm (publish always has confirm content); the actual save runs
  // from the dialog with the current handleSave, so the effect needs only saving + title.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !saving) {
        event.preventDefault()
        const content = publishActionConfirm("publish", title)
        if (content) setConfirm({ action: "publish", content })
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [saving, title])

  // Guard against losing unsaved edits on reload, tab close, or navigating away (admin
  // nav and command-palette jumps are full page loads, so this catches them too).
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [dirty])

  const titleRef = useRef<HTMLTextAreaElement>(null)
  // Auto-grow the title so long titles wrap instead of clipping at the canvas edge.
  // Declared before the loading guard so hook order stays stable across renders.
  // biome-ignore lint/correctness/useExhaustiveDependencies: title must re-measure scrollHeight whenever the value changes, even though it is not read directly in the effect body
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
  const saveStatus = saveState({ saving, dirty, error })

  return (
    <div className="cn-root" data-site-base={siteBase} data-mode={editorMode}>
      <main className="cn-canvas">
        <section className="cn-sheet" aria-label={`${collectionLabel} document`}>
          <div className="cn-sheet-head">
            <div className="cn-meta">
              <span>{collectionLabel}</span>
              <span>{saving ? "Saving..." : error ? "Needs attention" : statusLabel}</span>
            </div>
            <div className="cn-sheet-head-right">
              {bodyField ? (
                <div className="cn-mode-toggle">
                  <button
                    type="button"
                    aria-pressed={editorMode === "visual"}
                    className={editorMode === "visual" ? "cn-mode-btn cn-mode-on" : "cn-mode-btn"}
                    onClick={() => setEditorMode("visual")}
                  >
                    Visual
                  </button>
                  <button
                    type="button"
                    aria-pressed={editorMode === "document"}
                    className={editorMode === "document" ? "cn-mode-btn cn-mode-on" : "cn-mode-btn"}
                    onClick={() => setEditorMode("document")}
                  >
                    Document
                  </button>
                </div>
              ) : null}
              <div className="cn-presence" title="Current collaborator">
                <span style={{ background: collaborationUser.color }} aria-hidden="true" />
                {collaborationUser.name}
              </div>
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
            editorMode === "visual" ? (
              <VisualCanvas
                content={portableTextValue(data[bodyField])}
                apiBase={apiBase}
                collaboration={collaboration ?? undefined}
                onChange={(blocks) => {
                  setBodyBlocks(blocks)
                  updateField(bodyField, JSON.stringify(blocks))
                }}
              />
            ) : (
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
            )
          ) : (
            <div className="cn-empty">This collection has no rich text field.</div>
          )}
          <FieldsPanel
            fields={fields}
            data={data}
            updateField={updateField}
            exclude={[titleField, bodyField, "status"].filter((name): name is string =>
              Boolean(name),
            )}
            apiBase={apiBase}
          />
        </section>
      </main>

      {/* Visual mode is itself a live, brand-styled preview, so the ChannelMirror is
          redundant there and is hidden to give the canvas the full editor width. */}
      {editorMode === "document" ? (
        <ChannelMirror
          apiBase={apiBase}
          blocks={bodyBlocks}
          title={title || "Untitled"}
          byline={byline}
        />
      ) : null}

      <div className="cn-status">
        <div className="cn-status-meta">
          <span className="cn-status-state">{statusLabel}</span>
          <span className={`cn-status-save cn-status-save-${saveStatus}`} aria-live="polite">
            {saveStateLabel(saveStatus)}
          </span>
        </div>
        <button
          className="cn-status-btn"
          type="button"
          disabled={saving}
          onClick={() => handleSave("save_draft")}
        >
          Save
        </button>
        <button
          className="cn-status-btn"
          type="button"
          disabled={saving}
          onClick={() => handleSave("submit_review")}
        >
          Review
        </button>
        <button
          className="cn-status-publish"
          type="button"
          disabled={saving}
          onClick={() => requestAction("publish")}
        >
          <kbd>⌘↵</kbd> publish
        </button>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
        heading={confirm?.content.heading ?? ""}
        body={confirm?.content.body ?? ""}
        confirmLabel={confirm?.content.confirmLabel ?? "Confirm"}
        tone={confirm?.content.tone}
        busy={saving}
        onConfirm={() => {
          const action = confirm?.action
          setConfirm(null)
          if (action) void handleSave(action)
        }}
      />
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
