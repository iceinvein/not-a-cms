import type { FlowTrigger } from "../../components/automations/flow-types"

/** Build a trigger-shaped skeleton payload to prefill the test editor. */
export function defaultPayloadForTrigger(trigger: FlowTrigger): Record<string, unknown> {
  if (trigger.type.startsWith("content.")) {
    const base: Record<string, unknown> = { event: trigger.type }
    if ("collection" in trigger && trigger.collection) base.collection = trigger.collection
    base.document = {}
    return base
  }
  return { event: trigger.type }
}

/** Wrap a real collection document into a content-trigger payload. */
export function documentToPayload(trigger: FlowTrigger, doc: Record<string, unknown>): Record<string, unknown> {
  const base: Record<string, unknown> = { event: trigger.type }
  if ("collection" in trigger && trigger.collection) base.collection = trigger.collection
  base.document = doc
  return base
}
