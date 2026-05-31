import { useRef, useEffect, useMemo, useState } from "react"
import * as Y from "yjs"
import Collaboration from "@tiptap/extension-collaboration"

type CollabUser = {
  name: string
  color: string
}

type CollabPresenceUser = {
  clientId: string
  user: CollabUser
}

type CollabConfig = {
  serverUrl: string
  documentId: string
  user: CollabUser
}

type WebSocketLike = WebSocket & {
  addEventListener?: WebSocket["addEventListener"]
}

type RawProviderOptions = {
  WebSocketImpl?: typeof WebSocket
  clientId?: string
  user?: CollabUser
  onPresenceChange?: (users: CollabPresenceUser[]) => void
}

type PresenceMessage = {
  type: "presence"
  clientId: string
  user: CollabUser
  status: "online" | "offline"
}

export function collabUrl(serverUrl: string, documentId: string): string {
  const url = new URL(serverUrl)
  url.searchParams.set("doc", documentId)
  return url.toString()
}

export class RawYjsWebSocketProvider {
  readonly doc: Y.Doc
  readonly documentId: string
  readonly websocket: WebSocketLike
  readonly clientId: string
  private readonly WebSocketConstructor: typeof WebSocket
  private readonly pendingUpdates: Uint8Array[] = []
  private readonly presence = new Map<string, CollabUser>()
  private readonly user?: CollabUser
  private readonly onPresenceChange?: (users: CollabPresenceUser[]) => void
  private announced = false
  private readonly onDocUpdate: (update: Uint8Array, origin: unknown) => void

  constructor(serverUrl: string, documentId: string, doc: Y.Doc, options: RawProviderOptions = {}) {
    const WebSocketConstructor = options.WebSocketImpl ?? WebSocket
    this.WebSocketConstructor = WebSocketConstructor
    this.doc = doc
    this.documentId = documentId
    this.clientId = options.clientId ?? createClientId()
    this.user = options.user
    this.onPresenceChange = options.onPresenceChange
    this.websocket = new WebSocketConstructor(collabUrl(serverUrl, documentId)) as WebSocketLike
    this.websocket.binaryType = "arraybuffer"

    this.onDocUpdate = (update, origin) => {
      if (origin === this) return
      this.sendOrQueue(update)
    }

    this.doc.on("update", this.onDocUpdate)
    this.websocket.addEventListener("open", () => {
      this.flushPendingUpdates()
      this.announcePresence("online")
    })
    this.websocket.addEventListener("message", (event) => this.handleMessage(event.data))

    if (this.websocket.readyState === this.WebSocketConstructor.OPEN) {
      this.announcePresence("online")
    }
  }

  get presenceUsers(): CollabPresenceUser[] {
    return Array.from(this.presence.entries()).map(([clientId, user]) => ({ clientId, user }))
  }

  private sendOrQueue(update: Uint8Array): void {
    if (this.websocket.readyState === this.WebSocketConstructor.OPEN) {
      this.websocket.send(update)
      return
    }
    this.pendingUpdates.push(update)
  }

  private flushPendingUpdates(): void {
    while (this.pendingUpdates.length > 0 && this.websocket.readyState === this.WebSocketConstructor.OPEN) {
      const update = this.pendingUpdates.shift()
      if (update) this.websocket.send(update)
    }
  }

  handleMessage(data: unknown): void {
    if (typeof data === "string") {
      this.handleTextMessage(data)
      return
    }

    if (data instanceof ArrayBuffer) {
      Y.applyUpdate(this.doc, new Uint8Array(data), this)
      return
    }

    if (data instanceof Uint8Array) {
      Y.applyUpdate(this.doc, data, this)
      return
    }

    if (typeof Blob !== "undefined" && data instanceof Blob) {
      data.arrayBuffer().then((buffer) => {
        Y.applyUpdate(this.doc, new Uint8Array(buffer), this)
      }).catch(() => {})
    }
  }

  destroy(): void {
    this.announcePresence("offline")
    this.doc.off("update", this.onDocUpdate)
    this.websocket.close()
  }

  private announcePresence(status: PresenceMessage["status"]): void {
    if (!this.user) return
    if (status === "online" && this.announced) return
    if (this.websocket.readyState !== this.WebSocketConstructor.OPEN) return

    const message: PresenceMessage = {
      type: "presence",
      clientId: this.clientId,
      user: this.user,
      status,
    }
    this.websocket.send(JSON.stringify(message))
    if (status === "online") this.announced = true
  }

  private handleTextMessage(data: string): void {
    const message = parsePresenceMessage(data)
    if (!message || message.clientId === this.clientId) return

    if (message.status === "online") {
      this.presence.set(message.clientId, message.user)
    } else {
      this.presence.delete(message.clientId)
    }
    this.onPresenceChange?.(this.presenceUsers)
  }
}

function createClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

function parsePresenceMessage(data: string): PresenceMessage | null {
  try {
    const parsed = JSON.parse(data) as Partial<PresenceMessage>
    if (
      parsed.type !== "presence" ||
      typeof parsed.clientId !== "string" ||
      !parsed.user ||
      typeof parsed.user.name !== "string" ||
      typeof parsed.user.color !== "string" ||
      (parsed.status !== "online" && parsed.status !== "offline")
    ) {
      return null
    }
    return parsed as PresenceMessage
  } catch {
    return null
  }
}

export function useCollaboration(config?: CollabConfig | null) {
  const providerRef = useRef<RawYjsWebSocketProvider | null>(null)
  const [users, setUsers] = useState<CollabPresenceUser[]>([])
  const ydoc = useMemo(() => config ? new Y.Doc() : null, [config?.documentId])

  useEffect(() => {
    if (!config || !ydoc) {
      setUsers([])
      providerRef.current = null
      return
    }

    const provider = new RawYjsWebSocketProvider(
      config.serverUrl,
      config.documentId,
      ydoc,
      {
        user: config.user,
        onPresenceChange: setUsers,
      },
    )
    providerRef.current = provider

    return () => {
      provider.destroy()
      providerRef.current = null
      ydoc.destroy()
    }
  }, [config?.serverUrl, config?.documentId, config?.user.name, config?.user.color, ydoc])

  const extensions = useMemo(
    () => ydoc ? [Collaboration.configure({ document: ydoc })] : [],
    [ydoc],
  )

  return {
    ydoc,
    provider: providerRef.current,
    extensions,
    users,
  }
}

export type { CollabConfig, CollabPresenceUser, CollabUser }
