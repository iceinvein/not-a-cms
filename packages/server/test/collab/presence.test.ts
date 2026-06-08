import { describe, expect, test } from "bun:test"
import { PresenceRegistry } from "../../src/collab/presence"

const u = (name: string) => ({ name, color: "#c9956b" })

describe("PresenceRegistry", () => {
  test("online adds, snapshot reflects per-room users", () => {
    const r = new PresenceRegistry()
    r.applyPresence("content:post:1:body", {
      type: "presence",
      clientId: "c1",
      user: u("Sam"),
      status: "online",
    })
    r.applyPresence("content:post:1:body", {
      type: "presence",
      clientId: "c2",
      user: u("Jo"),
      status: "online",
    })
    const room = r.snapshot().find((x) => x.docName === "content:post:1:body")!
    expect(room.users.map((x) => x.name).sort()).toEqual(["Jo", "Sam"])
  })
  test("offline removes a client; empty rooms disappear", () => {
    const r = new PresenceRegistry()
    r.applyPresence("d", { type: "presence", clientId: "c1", user: u("Sam"), status: "online" })
    r.applyPresence("d", { type: "presence", clientId: "c1", user: u("Sam"), status: "offline" })
    expect(r.snapshot()).toEqual([])
  })
  test("leave(docName, clientId) handles abrupt disconnect", () => {
    const r = new PresenceRegistry()
    r.join("d", "c1", u("Sam"))
    r.leave("d", "c1")
    expect(r.snapshot()).toEqual([])
  })
})
