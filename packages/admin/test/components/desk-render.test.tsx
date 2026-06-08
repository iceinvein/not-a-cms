import { describe, expect, test } from "bun:test"
import React from "react"
import { renderToString } from "react-dom/server"
import { Desk } from "../../src/components/desk/Desk"

describe("Desk", () => {
  test("renders horizon lanes and a needs-you region with seeded data", () => {
    const html = renderToString(
      <Desk
        apiBase=""
        userName="Dik"
        initialHorizon={{
          now: [
            {
              collection: "post",
              documentId: "1",
              title: "Launch",
              publishedAt: "x",
              status: "scheduled",
            },
          ],
          today: [],
          week: [],
          later: [],
        }}
        initialNeedsYou={[
          {
            kind: "review",
            title: "Review 2 Posts",
            href: "/x",
            action: "review",
            severity: "info",
          },
        ]}
      />,
    )
    expect(html).toContain("Launch")
    expect(html).toContain("Now")
    expect(html).toContain("This week")
    expect(html).toContain("Needs you")
    expect(html).toContain("Review 2 Posts")
  })
})
