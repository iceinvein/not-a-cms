import React from "react"
import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { AccessSettings } from "../../src/components/AccessSettings"

describe("AccessSettings", () => {
  test("renders role and audit sections", () => {
    const html = renderToString(<AccessSettings apiBase="https://cms.example.test" />)

    expect(html).toContain("Access Control")
    expect(html).toContain("Roles")
    expect(html).toContain("Invites")
    expect(html).toContain("Team Members")
    expect(html).toContain("Audit Trail")
  })
})
