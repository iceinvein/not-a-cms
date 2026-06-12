// packages/admin/test/canvas/remote-selections.test.tsx
import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import type { RemoteSelection } from "../../src/components/continuum/canvas/presence"
import { RemoteSelections } from "../../src/components/continuum/canvas/RemoteSelections"

const selections: RemoteSelection[] = [
  {
    clientId: "a",
    color: "#3b82f6",
    name: "Ada",
    box: { top: 10, left: 20, width: 600, height: 200 },
  },
]

describe("RemoteSelections", () => {
  test("renders nothing when there are no selections", () => {
    expect(renderToString(<RemoteSelections selections={[]} />)).toBe("")
  })

  test("renders a colored outline box and a name chip per selection", () => {
    const html = renderToString(<RemoteSelections selections={selections} />)
    expect(html).toContain("cn-overlay-remote")
    expect(html).toContain("cn-overlay-remote-label")
    expect(html).toContain(">Ada<")
    expect(html).toContain("--cn-remote-color:#3b82f6")
  })
})
