import { describe, expect, test } from "bun:test"
import { renderToString } from "react-dom/server"
import { Rules } from "../../src/components/automations/Rules"

const flows = [
  {
    id: "f1",
    name: "Notify on publish",
    active: true,
    created_at: "",
    updated_at: "",
    trigger: { type: "content.published", collection: "post" },
    steps: [{ id: "a1", type: "action.webhook", config: {}, next: null }],
  },
]

describe("Rules", () => {
  test("renders each flow as a readable rule row", () => {
    const html = renderToString(<Rules apiBase="" initialFlows={flows as any} />)
    expect(html).toContain("Post")
    expect(html).toContain("published")
    expect(html).toContain("webhook")
  })
})
