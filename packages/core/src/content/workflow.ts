import type { ContentStatus } from "../types"

export type WorkflowAction = "save_draft" | "submit_review" | "publish" | "archive"

export type WorkflowTransition = {
  action: WorkflowAction
  from: ContentStatus
  to: ContentStatus
  event: string
}

const PUBLISH_ROLES = new Set(["admin", "editor"])
const WRITE_ROLES = new Set(["admin", "editor", "author"])

const TARGET_BY_ACTION: Record<WorkflowAction, ContentStatus> = {
  save_draft: "draft",
  submit_review: "in_review",
  publish: "published",
  archive: "archived",
}

const EVENT_BY_ACTION: Record<WorkflowAction, string> = {
  save_draft: "content.draft_saved",
  submit_review: "content.submitted_for_review",
  publish: "content.published",
  archive: "content.archived",
}

const ALLOWED_FROM: Record<WorkflowAction, ContentStatus[]> = {
  save_draft: ["draft", "in_review", "published", "archived", "scheduled"],
  submit_review: ["draft", "in_review", "scheduled"],
  publish: ["draft", "in_review", "published", "scheduled"],
  archive: ["draft", "in_review", "published", "archived", "scheduled"],
}

export class WorkflowError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = "WorkflowError"
    this.statusCode = statusCode
  }
}

export function resolveWorkflowTransition(
  from: ContentStatus,
  action: WorkflowAction,
  role: string,
): WorkflowTransition {
  assertAction(action)
  assertRole(action, role)

  if (!ALLOWED_FROM[action].includes(from)) {
    throw new WorkflowError(`Cannot ${actionLabel(action)} ${from} content`)
  }

  return {
    action,
    from,
    to: TARGET_BY_ACTION[action],
    event: EVENT_BY_ACTION[action],
  }
}

export function isWorkflowAction(action: unknown): action is WorkflowAction {
  return typeof action === "string" && action in TARGET_BY_ACTION
}

function assertAction(action: WorkflowAction) {
  if (!isWorkflowAction(action)) {
    throw new WorkflowError(`Unsupported workflow action "${String(action)}"`)
  }
}

function assertRole(action: WorkflowAction, role: string) {
  if (action === "publish" || action === "archive") {
    if (!PUBLISH_ROLES.has(role)) {
      throw new WorkflowError(`Role "${role}" cannot ${actionLabel(action)} content`, 403)
    }
    return
  }

  if (!WRITE_ROLES.has(role)) {
    throw new WorkflowError(`Role "${role}" cannot ${actionLabel(action)} content`, 403)
  }
}

function actionLabel(action: WorkflowAction): string {
  return action.replace(/_/g, " ")
}
