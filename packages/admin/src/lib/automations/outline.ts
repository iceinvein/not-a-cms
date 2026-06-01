import type { ActionStep, ConditionRule, ConditionStep, Flow } from "../../components/automations/flow-types"

export type RuleOutline = {
  when: {
    label: string
    collection?: string
  }
  match: "all" | "any" | null
  rules: ConditionRule[]
  actions: Array<{
    id: string
    type: string
    label: string
  }>
}

const TRIGGER_LABEL: Record<string, string> = {
  "content.created": "created",
  "content.updated": "updated",
  "content.published": "published",
  "content.deleted": "deleted",
}

function actionLabel(step: ActionStep): string {
  return step.label ?? step.type.replace("action.", "").replace(/_/g, " ")
}

export function flowToOutline(flow: Flow): RuleOutline {
  const trigger = flow.trigger
  const when =
    trigger.type === "schedule.cron"
      ? { label: `every ${trigger.cron}` }
      : trigger.type === "webhook.received"
        ? { label: "webhook received" }
        : {
            label: `${trigger.collection ?? "content"} ${TRIGGER_LABEL[trigger.type] ?? trigger.type}`,
            collection: trigger.collection,
          }

  const condition = flow.steps.find((step): step is ConditionStep => step.type === "condition")
  const actions = flow.steps
    .filter((step): step is ActionStep => step.type.startsWith("action."))
    .map((step) => ({
      id: step.id,
      type: step.type,
      label: actionLabel(step),
    }))

  return {
    when,
    match: condition?.match ?? null,
    rules: condition?.rules ?? [],
    actions,
  }
}
