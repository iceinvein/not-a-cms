import { useRef, useEffect, useMemo } from "react"
import * as Y from "yjs"
import { WebsocketProvider } from "y-websocket"
import Collaboration from "@tiptap/extension-collaboration"
import CollaborationCaret from "@tiptap/extension-collaboration-caret"

type CollabUser = {
  name: string
  color: string
}

type CollabConfig = {
  serverUrl: string
  documentId: string
  user: CollabUser
}

export function useCollaboration(config: CollabConfig) {
  const ydocRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)

  if (!ydocRef.current) {
    ydocRef.current = new Y.Doc()
  }

  if (!providerRef.current) {
    providerRef.current = new WebsocketProvider(
      config.serverUrl,
      config.documentId,
      ydocRef.current,
    )
  }

  useEffect(() => {
    return () => {
      providerRef.current?.destroy()
      ydocRef.current?.destroy()
    }
  }, [])

  const extensions = useMemo(
    () => [
      Collaboration.configure({ document: ydocRef.current! }),
      CollaborationCaret.configure({
        provider: providerRef.current!,
        user: config.user,
      }),
    ],
    [],
  )

  return {
    ydoc: ydocRef.current,
    provider: providerRef.current,
    extensions,
  }
}

export type { CollabConfig, CollabUser }
