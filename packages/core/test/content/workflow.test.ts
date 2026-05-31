import { describe, expect, test } from "bun:test"
import {
  WorkflowError,
  resolveWorkflowTransition,
} from "../../src/content/workflow"

describe("content workflow", () => {
  test("allows draft content to be submitted for review", () => {
    const transition = resolveWorkflowTransition("draft", "submit_review", "author")

    expect(transition).toEqual({
      action: "submit_review",
      from: "draft",
      to: "in_review",
      event: "content.submitted_for_review",
    })
  })

  test("allows editors to publish reviewed content", () => {
    const transition = resolveWorkflowTransition("in_review", "publish", "editor")

    expect(transition.to).toBe("published")
    expect(transition.event).toBe("content.published")
  })

  test("only admins and editors can publish or archive", () => {
    expect(() => resolveWorkflowTransition("draft", "publish", "author")).toThrow(WorkflowError)
    expect(() => resolveWorkflowTransition("published", "archive", "author")).toThrow(WorkflowError)
  })

  test("rejects unsupported transitions", () => {
    expect(() => resolveWorkflowTransition("archived", "publish", "admin")).toThrow("Cannot publish archived content")
  })
})
