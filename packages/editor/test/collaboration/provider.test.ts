import { describe, expect, test } from "bun:test"
import * as Y from "yjs"
import { collabUrl, RawYjsWebSocketProvider } from "../../src/collaboration/provider"

describe("RawYjsWebSocketProvider", () => {
  test("builds a raw collaboration websocket URL with encoded document id", () => {
    expect(collabUrl("ws://localhost:4321/collab", "content:blog_post:abc:body")).toBe(
      "ws://localhost:4321/collab?doc=content%3Ablog_post%3Aabc%3Abody",
    )
    expect(collabUrl("ws://localhost:4321/collab?token=one", "doc 1")).toBe(
      "ws://localhost:4321/collab?token=one&doc=doc+1",
    )
  })

  test("sends local Yjs document updates as websocket binary frames", () => {
    const sent: Uint8Array[] = []
    class FakeWebSocket extends EventTarget {
      static OPEN = 1
      readyState = FakeWebSocket.OPEN
      binaryType = "blob"
      closeCalled = false

      constructor(public url: string) {
        super()
      }

      send(data: Uint8Array) {
        sent.push(data)
      }

      close() {
        this.closeCalled = true
      }
    }

    const doc = new Y.Doc()
    const provider = new RawYjsWebSocketProvider("ws://localhost:4321/collab", "doc-1", doc, {
      WebSocketImpl: FakeWebSocket as any,
    })

    doc.getText("default").insert(0, "hello")

    expect((provider.websocket as any).url).toBe("ws://localhost:4321/collab?doc=doc-1")
    expect(sent.length).toBe(1)

    provider.destroy()
    expect((provider.websocket as any).closeCalled).toBe(true)
  })

  test("applies remote binary updates without echoing them back", () => {
    const sent: Uint8Array[] = []
    class FakeWebSocket extends EventTarget {
      static OPEN = 1
      readyState = FakeWebSocket.OPEN
      binaryType = "blob"

      constructor(public url: string) {
        super()
      }

      send(data: Uint8Array) {
        sent.push(data)
      }

      close() {}
    }

    const remoteDoc = new Y.Doc()
    remoteDoc.getText("default").insert(0, "remote")
    const update = Y.encodeStateAsUpdate(remoteDoc)

    const localDoc = new Y.Doc()
    const provider = new RawYjsWebSocketProvider("ws://localhost:4321/collab", "doc-1", localDoc, {
      WebSocketImpl: FakeWebSocket as any,
    })

    provider.handleMessage(update)

    expect(localDoc.getText("default").toString()).toBe("remote")
    expect(sent).toHaveLength(0)
    provider.destroy()
  })

  test("queues local updates until the websocket opens", () => {
    const sent: Uint8Array[] = []
    class FakeWebSocket extends EventTarget {
      static CONNECTING = 0
      static OPEN = 1
      readyState = FakeWebSocket.CONNECTING
      binaryType = "blob"

      constructor(public url: string) {
        super()
      }

      send(data: Uint8Array) {
        sent.push(data)
      }

      open() {
        this.readyState = FakeWebSocket.OPEN
        this.dispatchEvent(new Event("open"))
      }

      close() {}
    }

    const doc = new Y.Doc()
    const provider = new RawYjsWebSocketProvider("ws://localhost:4321/collab", "doc-1", doc, {
      WebSocketImpl: FakeWebSocket as any,
    })

    doc.getText("default").insert(0, "hello")
    expect(sent).toHaveLength(0)

    ;(provider.websocket as any).open()
    expect(sent).toHaveLength(1)
    provider.destroy()
  })

  test("announces the local user on open and tracks remote collaborators", () => {
    const sent: string[] = []
    class FakeWebSocket extends EventTarget {
      static OPEN = 1
      readyState = FakeWebSocket.OPEN
      binaryType = "blob"

      constructor(public url: string) {
        super()
      }

      send(data: string | Uint8Array) {
        if (typeof data === "string") sent.push(data)
      }

      close() {}
    }

    const presenceSnapshots: string[][] = []
    const doc = new Y.Doc()
    const provider = new RawYjsWebSocketProvider("ws://localhost:4321/collab", "doc-1", doc, {
      WebSocketImpl: FakeWebSocket as any,
      clientId: "local-client",
      user: { name: "Local Editor", color: "#c9956b" },
      onPresenceChange: (users) => presenceSnapshots.push(users.map((entry) => entry.user.name)),
    })

    expect(JSON.parse(sent[0]!)).toEqual({
      type: "presence",
      clientId: "local-client",
      user: { name: "Local Editor", color: "#c9956b" },
      status: "online",
    })

    provider.handleMessage(
      JSON.stringify({
        type: "presence",
        clientId: "remote-client",
        user: { name: "Remote Editor", color: "#38bdf8" },
        status: "online",
      }),
    )

    expect(provider.presenceUsers.map((entry) => entry.user.name)).toEqual(["Remote Editor"])
    expect(presenceSnapshots.at(-1)).toEqual(["Remote Editor"])

    provider.handleMessage(
      JSON.stringify({
        type: "presence",
        clientId: "remote-client",
        user: { name: "Remote Editor", color: "#38bdf8" },
        status: "offline",
      }),
    )

    expect(provider.presenceUsers).toEqual([])
    provider.destroy()
  })
})
