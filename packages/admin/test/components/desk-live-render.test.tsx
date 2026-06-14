import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { Desk } from "../../src/components/desk/Desk"

describe("Desk Live-now", () => {
  test("renders live editors from initialLive", () => {
    const html = renderToString(
      <Desk
        apiBase=""
        userName="Dik"
        initialHorizon={{ now: [], today: [], week: [], later: [] }}
        initialNeedsYou={[]}
        initialLive={[
          {
            name: "Sam",
            color: "#c9956b",
            title: "Launch week",
            href: "/content/post/1",
            collection: "post",
            documentId: "1",
          },
        ]}
      />,
    )
    expect(html).toContain("Presence")
    expect(html).toContain("Sam")
    expect(html).toContain("Launch week")
  })
})
