import type { WorkflowAction } from "./use-document"

export type ConfirmTone = "default" | "danger"

export type ConfirmContent = {
  heading: string
  body: string
  confirmLabel: string
  tone: ConfirmTone
}

/**
 * The confirmation copy for a workflow action that changes a document's public
 * visibility. Publish (goes live) and Archive (taken offline) name their consequence
 * and the document by title; the low-stakes Save/Review actions return null so they
 * stay frictionless.
 */
export function publishActionConfirm(action: WorkflowAction, title: string): ConfirmContent | null {
  const trimmed = title.trim()
  const name = trimmed ? `"${trimmed}"` : "this document"

  switch (action) {
    case "publish":
      return {
        heading: "Publish to your site?",
        body: `This makes ${name} live on your public site right now. Anyone with the link can see it.`,
        confirmLabel: "Publish now",
        tone: "default",
      }
    case "archive":
      return {
        heading: "Archive this document?",
        body: `This removes ${name} from your public site. You can republish it later.`,
        confirmLabel: "Archive",
        tone: "danger",
      }
    default:
      return null
  }
}
