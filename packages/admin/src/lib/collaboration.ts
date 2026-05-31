import type { CollabConfig, CollabUser } from "@not-a-cms/editor"

export function contentCollabDocumentId(collection: string, documentId: string, fieldName: string): string {
  return `content:${collection}:${documentId}:${fieldName}`
}

export function collabServerUrl(apiBase: string): string {
  const url = new URL(apiBase || "http://localhost:4321")
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/collab`
  url.search = ""
  url.hash = ""
  return url.toString().replace(/\/$/, "")
}

export function defaultCollabUser(): CollabUser {
  return {
    name: "Editor",
    color: "#c9956b",
  }
}

export function buildCollaborationConfig({
  apiBase,
  collection,
  documentId,
  fieldName,
  user = defaultCollabUser(),
}: {
  apiBase: string
  collection: string
  documentId?: string
  fieldName: string
  user?: CollabUser
}): CollabConfig | null {
  if (!documentId) return null

  return {
    serverUrl: collabServerUrl(apiBase),
    documentId: contentCollabDocumentId(collection, documentId, fieldName),
    user,
  }
}
