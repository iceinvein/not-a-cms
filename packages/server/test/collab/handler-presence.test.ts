import { describe, expect, test } from "bun:test"
import { collabWebSocket, presenceSnapshot } from "../../src/collab/handler"

function fakeWs(docName: string, published: string[] = []) {
  return {
    data: { docName } as any,
    send() {},
    subscribe() {},
    unsubscribe() {},
    publish(_: string, message: string) {
      published.push(message)
    },
  }
}

describe("collab handler presence wiring", () => {
  test("a presence online message registers the client; close removes it", () => {
    const docName = "content:post:wire-test:body"
    const ws = fakeWs(docName)
    collabWebSocket.open(ws as any)
    collabWebSocket.message(
      ws as any,
      JSON.stringify({
        type: "presence",
        clientId: "cX",
        user: { name: "Sam", color: "#c9956b" },
        status: "online",
      }),
    )

    const room = presenceSnapshot().find((r) => r.docName === docName)
    expect(room?.users.map((u) => u.name)).toEqual(["Sam"])

    collabWebSocket.close(ws as any)
    expect(presenceSnapshot().find((r) => r.docName === docName)).toBeUndefined()
  })

  test("close broadcasts an offline presence message to peers", () => {
    const published: string[] = []
    const ws = fakeWs("content:post:close-test:body", published)
    collabWebSocket.open(ws as any)
    collabWebSocket.message(
      ws as any,
      JSON.stringify({
        type: "presence",
        clientId: "cY",
        user: { name: "Riley", color: "#38bdf8" },
        status: "online",
      }),
    )

    collabWebSocket.close(ws as any)

    expect(JSON.parse(published.at(-1)!)).toEqual({
      type: "presence",
      clientId: "cY",
      user: { name: "Riley", color: "#38bdf8" },
      status: "offline",
    })
  })
})
