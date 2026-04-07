import { test, expect, describe } from "bun:test"
import type { Flow, FlowStep, FlowTrigger, ConditionStep, ActionStep } from "../../src/automations/types"

describe("automation types", () => {
  test("a content trigger with collection compiles", () => {
    const trigger: FlowTrigger = { type: "content.published", collection: "posts" }
    expect(trigger.type).toBe("content.published")
  })

  test("a cron trigger requires cron field", () => {
    const trigger: FlowTrigger = { type: "schedule.cron", cron: "0 * * * *" }
    expect(trigger.cron).toBe("0 * * * *")
  })

  test("a condition step has branches", () => {
    const step: ConditionStep = {
      id: "s1", type: "condition",
      rules: [{ field: "status", operator: "eq", value: "published" }],
      match: "all", branches: { true: "s2", false: null },
    }
    expect(step.branches.true).toBe("s2")
  })

  test("an action step has config and next", () => {
    const step: ActionStep = {
      id: "s2", type: "action.webhook",
      config: { url: "https://example.com", method: "POST" }, next: null,
    }
    expect(step.type).toBe("action.webhook")
  })

  test("FlowStep union accepts both condition and action", () => {
    const steps: FlowStep[] = [
      { id: "s1", type: "condition", rules: [], match: "all", branches: { true: "s2", false: null } },
      { id: "s2", type: "action.log", config: { message: "hello" }, next: null },
    ]
    expect(steps).toHaveLength(2)
  })
})
