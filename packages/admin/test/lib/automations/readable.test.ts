import { describe, expect, test } from "bun:test"
import { flowToReadable, type RuleToken } from "../../../src/lib/automations/readable"

describe("flowToReadable", () => {
  test("content.published with collection + condition + actions", () => {
    const tokens = flowToReadable({
      id: "f",
      name: "x",
      active: true,
      created_at: "",
      updated_at: "",
      trigger: { type: "content.published", collection: "post" },
      steps: [
        {
          id: "c",
          type: "condition",
          rules: [{ field: "category", operator: "eq", value: "News" }],
          match: "all",
          branches: { true: "a1", false: null },
        },
        { id: "a1", type: "action.webhook", config: {}, next: "a2" },
        { id: "a2", type: "action.log", config: {}, next: null },
      ],
    } as any)
    const kinds = (k: RuleToken["kind"]) => tokens.filter((t) => t.kind === k).map((t) => t.text)
    expect(kinds("trigger")).toContain("published")
    expect(kinds("entity")).toContain("Post")
    expect(kinds("condition").join(" ")).toContain("category")
    expect(kinds("action").length).toBe(2)
  })

  test("schedule.cron reads as Every <cron>", () => {
    const tokens = flowToReadable({
      id: "f",
      name: "x",
      active: true,
      created_at: "",
      updated_at: "",
      trigger: { type: "schedule.cron", cron: "0 8 * * 1" },
      steps: [],
    } as any)
    expect(tokens.some((t) => t.kind === "kw" && t.text === "Every")).toBe(true)
    expect(tokens.some((t) => t.kind === "trigger" && t.text.includes("0 8 * * 1"))).toBe(true)
  })
})
