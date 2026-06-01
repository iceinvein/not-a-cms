import { describe, expect, test } from "bun:test"
import { flowToOutline } from "../../../src/lib/automations/outline"

describe("flowToOutline", () => {
  test("produces WHEN/IF/DO normalized structure", () => {
    const o = flowToOutline({
      id: "f", name: "x", active: true, created_at: "", updated_at: "",
      trigger: { type: "content.published", collection: "post" },
      steps: [
        { id: "c", type: "condition", rules: [{ field: "category", operator: "eq", value: "News" }], match: "all", branches: { true: "a1", false: null } },
        { id: "a1", type: "action.webhook", label: "Notify", config: {}, next: "a2" },
        { id: "a2", type: "action.log", config: {}, next: null },
      ],
    } as any)

    expect(o.when.label).toContain("published")
    expect(o.match).toBe("all")
    expect(o.rules).toHaveLength(1)
    expect(o.actions.map((a) => a.id)).toEqual(["a1", "a2"])
    expect(o.actions[0].label).toBe("Notify")
  })
})
