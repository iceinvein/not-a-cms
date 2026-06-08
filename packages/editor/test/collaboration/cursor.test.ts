import { describe, expect, test } from "bun:test"
import * as Y from "yjs"
import { RawYjsWebSocketProvider } from "../../src/collaboration/provider"

describe("RawYjsWebSocketProvider cursor protocol", () => {
  test("sendCursor emits a cursor frame", () => {
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

    const provider = new RawYjsWebSocketProvider(
      "ws://localhost:4321/collab",
      "doc-1",
      new Y.Doc(),
      {
        WebSocketImpl: FakeWebSocket as any,
        clientId: "local-client",
        user: { name: "Local Editor", color: "#c9956b" },
      },
    )

    provider.sendCursor(3, 7)

    const frame = JSON.parse(sent.find((message) => message.includes('"cursor"'))!)
    expect(frame).toEqual({
      type: "cursor",
      clientId: "local-client",
      user: { name: "Local Editor", color: "#c9956b" },
      anchor: 3,
      head: 7,
    })
    provider.destroy()
  })

  test("receives peer cursor frames and ignores local echoes", () => {
    class FakeWebSocket extends EventTarget {
      static OPEN = 1
      readyState = FakeWebSocket.OPEN
      binaryType = "blob"

      constructor(public url: string) {
        super()
      }

      send() {}
      close() {}
    }

    const cursorSnapshots: string[][] = []
    const provider = new RawYjsWebSocketProvider(
      "ws://localhost:4321/collab",
      "doc-1",
      new Y.Doc(),
      {
        WebSocketImpl: FakeWebSocket as any,
        clientId: "local-client",
        user: { name: "Local Editor", color: "#c9956b" },
        onCursorChange: (cursors) =>
          cursorSnapshots.push(
            cursors.map((cursor) => `${cursor.clientId}:${cursor.anchor}:${cursor.head}`),
          ),
      },
    )

    provider.handleMessage(
      JSON.stringify({
        type: "cursor",
        clientId: "remote-client",
        user: { name: "Remote Editor", color: "#38bdf8" },
        anchor: 4,
        head: 9,
      }),
    )

    expect(cursorSnapshots.at(-1)).toEqual(["remote-client:4:9"])

    provider.handleMessage(
      JSON.stringify({
        type: "cursor",
        clientId: "local-client",
        user: { name: "Local Editor", color: "#c9956b" },
        anchor: 1,
        head: 2,
      }),
    )

    expect(cursorSnapshots).toHaveLength(1)
    provider.destroy()
  })

  test("removes peer cursor state when presence goes offline", () => {
    class FakeWebSocket extends EventTarget {
      static OPEN = 1
      readyState = FakeWebSocket.OPEN
      binaryType = "blob"

      constructor(public url: string) {
        super()
      }

      send() {}
      close() {}
    }

    const cursorSnapshots: number[] = []
    const provider = new RawYjsWebSocketProvider(
      "ws://localhost:4321/collab",
      "doc-1",
      new Y.Doc(),
      {
        WebSocketImpl: FakeWebSocket as any,
        clientId: "local-client",
        user: { name: "Local Editor", color: "#c9956b" },
        onCursorChange: (cursors) => cursorSnapshots.push(cursors.length),
      },
    )

    provider.handleMessage(
      JSON.stringify({
        type: "cursor",
        clientId: "remote-client",
        user: { name: "Remote Editor", color: "#38bdf8" },
        anchor: 4,
        head: 9,
      }),
    )
    provider.handleMessage(
      JSON.stringify({
        type: "presence",
        clientId: "remote-client",
        user: { name: "Remote Editor", color: "#38bdf8" },
        status: "offline",
      }),
    )

    expect(cursorSnapshots).toEqual([1, 0])
    provider.destroy()
  })
})
