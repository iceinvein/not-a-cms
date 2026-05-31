import type { FlowStore } from "./store"
import type { Flow, FlowRun, FlowStep, ConditionStep, ActionStep, ConditionRule } from "./types"

export function resolvePayloadPath(payload: Record<string, unknown>, path: string): unknown {
  const cleanPath = path.startsWith("payload.") ? path.slice("payload.".length) : path
  const parts = cleanPath.split(".")
  let current: unknown = payload
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export function interpolate(template: string, payload: Record<string, unknown>): string {
  return template.replace(/\{\{(.+?)\}\}/g, (_match, path: string) => {
    const value = resolvePayloadPath(payload, path.trim())
    return value !== undefined && value !== null ? String(value) : ""
  })
}

export function evaluateCondition(rule: ConditionRule, payload: Record<string, unknown>): boolean {
  const actual = resolvePayloadPath(payload, rule.field)
  switch (rule.operator) {
    case "eq": return actual === rule.value
    case "neq": return actual !== rule.value
    case "contains": return typeof actual === "string" && actual.includes(String(rule.value))
    case "not_contains": return typeof actual === "string" && !actual.includes(String(rule.value))
    case "gt": return typeof actual === "number" && actual > Number(rule.value)
    case "lt": return typeof actual === "number" && actual < Number(rule.value)
    case "matches": {
      if (typeof actual !== "string") return false
      try { return new RegExp(String(rule.value)).test(actual) } catch { return false }
    }
    default: return false
  }
}

function resolveStepById(steps: FlowStep[], stepId: string): FlowStep | undefined {
  return steps.find(s => s.id === stepId)
}

function evaluateConditionStep(step: ConditionStep, payload: Record<string, unknown>): boolean {
  if (step.match === "any") {
    return step.rules.some(rule => evaluateCondition(rule, payload))
  }
  return step.rules.every(rule => evaluateCondition(rule, payload))
}

export type FlowEngineOptions = {
  webhookRetryDelays?: number[]
}

export function createFlowEngine(store: FlowStore, options: FlowEngineOptions = {}) {
  const webhookRetryDelays = options.webhookRetryDelays ?? [1000, 5000, 15000]

  async function executeActionStep(step: ActionStep, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    switch (step.type) {
      case "action.log": {
        const message = interpolate(String(step.config.message ?? ""), payload)
        return { message }
      }
      case "action.transform": {
        const mappings = step.config.mappings as Record<string, string> | undefined
        if (!mappings) return payload
        const result: Record<string, unknown> = {}
        for (const [key, pathOrTemplate] of Object.entries(mappings)) {
          if (pathOrTemplate.includes("{{")) {
            result[key] = interpolate(pathOrTemplate, payload)
          } else if (pathOrTemplate.startsWith('"') && pathOrTemplate.endsWith('"')) {
            result[key] = pathOrTemplate.slice(1, -1)
          } else {
            result[key] = resolvePayloadPath(payload, pathOrTemplate)
          }
        }
        return result
      }
      case "action.webhook": {
        const url = interpolate(String(step.config.url ?? ""), payload)
        const method = String(step.config.method ?? "POST")
        const headers: Record<string, string> = { "Content-Type": "application/json" }
        if (step.config.headers && typeof step.config.headers === "object") {
          for (const [k, v] of Object.entries(step.config.headers as Record<string, string>)) {
            headers[k] = interpolate(v, payload)
          }
        }
        const body = JSON.stringify(payload)
        const retryDelays = webhookRetryDelays
        let lastError: Error | null = null
        for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
          try {
            const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(10000) })
            const responseBody = await res.text().catch(() => "")
            if (!res.ok) {
              lastError = new Error(`Webhook failed: ${res.status} ${responseBody}`)
              if (attempt < retryDelays.length) { await new Promise(r => setTimeout(r, retryDelays[attempt])); continue }
              throw lastError
            }
            try { return JSON.parse(responseBody) } catch { return { response: responseBody, status: res.status } }
          } catch (err: any) {
            lastError = err
            if (attempt < retryDelays.length) { await new Promise(r => setTimeout(r, retryDelays[attempt])); continue }
            throw lastError
          }
        }
        throw lastError ?? new Error("Webhook failed after retries")
      }
      case "action.email": {
        const to = interpolate(String(step.config.to ?? ""), payload)
        const subject = interpolate(String(step.config.subject ?? ""), payload)
        return { sent: true, to, subject }
      }
      case "action.create_content": {
        const collection = String(step.config.collection ?? "")
        const dataTemplate = step.config.data as Record<string, string> | undefined
        const data: Record<string, unknown> = {}
        if (dataTemplate) {
          for (const [k, v] of Object.entries(dataTemplate)) {
            data[k] = v.includes("{{") ? interpolate(v, payload) : resolvePayloadPath(payload, v) ?? v
          }
        }
        return { action: "create_content", collection, data }
      }
      case "action.update_content": {
        const collection = String(step.config.collection ?? "")
        const documentId = interpolate(String(step.config.documentId ?? ""), payload)
        const dataTemplate = step.config.data as Record<string, string> | undefined
        const data: Record<string, unknown> = {}
        if (dataTemplate) {
          for (const [k, v] of Object.entries(dataTemplate)) {
            data[k] = v.includes("{{") ? interpolate(v, payload) : resolvePayloadPath(payload, v) ?? v
          }
        }
        return { action: "update_content", collection, documentId, data }
      }
      case "action.delete_content": {
        const collection = String(step.config.collection ?? "")
        const documentId = interpolate(String(step.config.documentId ?? ""), payload)
        return { action: "delete_content", collection, documentId }
      }
      default:
        return payload
    }
  }

  async function executeFlow(flow: Flow, triggerPayload: Record<string, unknown>): Promise<string> {
    const run = store.createRun(flow.id, flow.trigger.type, JSON.stringify(triggerPayload))
    if (flow.steps.length === 0) {
      store.completeRun(run.id, "completed")
      return run.id
    }
    let currentStep: FlowStep | undefined = flow.steps[0]
    let currentPayload = triggerPayload
    try {
      while (currentStep) {
        const step: FlowStep = currentStep
        const stepInput = JSON.stringify(currentPayload)
        if (step.type === "condition") {
          const result = evaluateConditionStep(step, currentPayload)
          const branchTaken = result ? "true" : "false"
          store.recordStep({ run_id: run.id, step_id: step.id, status: "completed", input: stepInput, output: stepInput, branch_taken: branchTaken })
          const nextId: string | null | undefined = result ? step.branches.true : step.branches.false
          currentStep = nextId ? resolveStepById(flow.steps, nextId) : undefined
        } else {
          try {
            const output = await executeActionStep(step, currentPayload)
            store.recordStep({ run_id: run.id, step_id: step.id, status: "completed", input: stepInput, output: JSON.stringify(output) })
            currentPayload = output
            currentStep = step.next ? resolveStepById(flow.steps, step.next) : undefined
          } catch (err: any) {
            store.recordStep({ run_id: run.id, step_id: step.id, status: "failed", input: stepInput, error: err.message })
            store.completeRun(run.id, "failed", err.message)
            return run.id
          }
        }
      }
      store.completeRun(run.id, "completed")
    } catch (err: any) {
      store.completeRun(run.id, "failed", err.message)
    }
    return run.id
  }

  async function retryRun(flow: Flow, runOrId: FlowRun | string): Promise<string> {
    const run = typeof runOrId === "string" ? store.getRun(runOrId) : runOrId
    if (!run) throw new Error("Run not found")
    if (run.flow_id !== flow.id) throw new Error("Run does not belong to this flow")
    if (run.status !== "failed") throw new Error("Only failed runs can be retried")

    let payload: Record<string, unknown> = {}
    if (run.trigger_payload) {
      try {
        const parsed = JSON.parse(run.trigger_payload)
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          payload = parsed as Record<string, unknown>
        }
      } catch {
        payload = { value: run.trigger_payload }
      }
    }
    return executeFlow(flow, { ...payload, retriedFromRunId: run.id })
  }

  return { executeFlow, retryRun }
}

export type FlowEngine = ReturnType<typeof createFlowEngine>
