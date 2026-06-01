import type { ActionStep, ConditionStep, Flow } from "../../components/automations/flow-types"

export type RuleToken = {
  kind: "kw" | "trigger" | "entity" | "condition" | "action"
  text: string
}

const TRIGGER_VERB: Record<string, string> = {
  "content.created": "created",
  "content.updated": "updated",
  "content.published": "published",
  "content.deleted": "deleted",
}

const OPERATOR_LABEL: Record<string, string> = {
  eq: "equals",
  neq: "does not equal",
  contains: "contains",
  not_contains: "does not contain",
  matches: "matches",
  gt: "is greater than",
  lt: "is less than",
}

function humanize(name: string): string {
  return name.replace(/[_-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function actionLabel(step: ActionStep): string {
  return step.label ?? step.type.replace("action.", "").replace(/_/g, " ")
}

export function flowToReadable(flow: Flow): RuleToken[] {
  const tokens: RuleToken[] = []
  const trigger = flow.trigger

  if (trigger.type === "schedule.cron") {
    tokens.push({ kind: "kw", text: "Every" }, { kind: "trigger", text: trigger.cron })
  } else if (trigger.type === "webhook.received") {
    tokens.push({ kind: "kw", text: "On" }, { kind: "trigger", text: "webhook received" })
  } else {
    tokens.push({ kind: "kw", text: "When" })
    tokens.push({ kind: "entity", text: trigger.collection ? humanize(trigger.collection) : "content" })
    tokens.push({ kind: "kw", text: "is" }, { kind: "trigger", text: TRIGGER_VERB[trigger.type] ?? trigger.type })
  }

  const condition = flow.steps.find((step): step is ConditionStep => step.type === "condition")
  if (condition) {
    const joiner = condition.match === "all" ? " and " : " or "
    const text = condition.rules
      .map((rule) => `${rule.field} ${OPERATOR_LABEL[rule.operator] ?? rule.operator} ${String(rule.value)}`)
      .join(joiner)
    tokens.push({ kind: "kw", text: "if" }, { kind: "condition", text: text || "rules match" })
  }

  const actions = flow.steps.filter((step): step is ActionStep => step.type.startsWith("action."))
  if (actions.length > 0) {
    tokens.push({ kind: "kw", text: "then" })
    for (const action of actions) {
      tokens.push({ kind: "action", text: actionLabel(action) })
    }
  }

  return tokens
}
