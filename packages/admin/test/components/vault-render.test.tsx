import React from "react"
import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { Vault } from "../../src/components/vault/Vault"

const items = [
  { id: "a", filename: "hero.jpg", mimetype: "image/jpeg", size: 1, uploadedAt: "", url: "/hero.jpg" },
  { id: "c", filename: "old.png", mimetype: "image/png", size: 1, uploadedAt: "", url: "/old.png" },
]

describe("Vault", () => {
  test("renders clusters incl. Unused and a detail panel with usage", () => {
    const html = renderToString(
      <Vault
        apiBase=""
        initialItems={items as any}
        initialCounts={{ a: 4, c: 0 }}
        initialSelected={items[0] as any}
        initialUsage={{ count: 4, references: [{ collection: "post", documentId: "p1", label: "Launch", field: "cover" }] }}
      />,
    )
    expect(html).toContain("Images")
    expect(html).toContain("Unused")
    expect(html).toContain("Used in")
    expect(html).toContain("Launch")
  })
})
