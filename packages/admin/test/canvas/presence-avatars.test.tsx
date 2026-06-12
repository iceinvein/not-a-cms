import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { PresenceAvatars } from "../../src/components/continuum/canvas/PresenceAvatars"

const users = [
  { clientId: "a", user: { name: "Ada Lovelace", color: "#3b82f6" } },
  { clientId: "b", user: { name: "grace hopper", color: "#16a34a" } },
]

describe("PresenceAvatars", () => {
  test("renders nothing when there are no collaborators", () => {
    expect(renderToString(<PresenceAvatars users={[]} />)).toBe("")
  })

  test("renders one avatar per collaborator with an uppercased initial and a name tooltip", () => {
    const html = renderToString(<PresenceAvatars users={users} />)
    expect(html).toContain("cn-presence-avatars")
    expect((html.match(/cn-presence-avatar"/g) ?? []).length).toBe(2)
    expect(html).toContain(">A<")
    expect(html).toContain(">G<")
    expect(html).toContain('title="Ada Lovelace"')
    expect(html).toContain('title="grace hopper"')
  })

  test("sanitizes an unsafe color to the fallback", () => {
    const html = renderToString(
      <PresenceAvatars users={[{ clientId: "x", user: { name: "Mallory", color: "red; x:1" } }]} />,
    )
    expect(html).not.toContain("red; x:1")
    expect(html).toContain("#38bdf8")
  })
})
