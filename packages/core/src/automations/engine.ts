import type { RunEvent } from "./events"
import type { FlowStore, RecordStepInput } from "./store"
import type {
  ActionStep,
  ConditionRule,
  ConditionStep,
  DryRunResult,
  DryRunStep,
  Flow,
  FlowRun,
  FlowRunStatus,
  FlowStep,
} from "./types"

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
    case "eq":
      return actual === rule.value
    case "neq":
      return actual !== rule.value
    case "contains":
      return typeof actual === "string" && actual.includes(String(rule.value))
    case "not_contains":
      return typeof actual === "string" && !actual.includes(String(rule.value))
    case "gt":
      return typeof actual === "number" && actual > Number(rule.value)
    case "lt":
      return typeof actual === "number" && actual < Number(rule.value)
    case "matches": {
      if (typeof actual !== "string") return false
      try {
        return new RegExp(String(rule.value)).test(actual)
      } catch {
        return false
      }
    }
    default:
      return false
  }
}

function resolveStepById(steps: FlowStep[], stepId: string): FlowStep | undefined {
  return steps.find((s) => s.id === stepId)
}

function evaluateConditionStep(step: ConditionStep, payload: Record<string, unknown>): boolean {
  if (step.match === "any") {
    return step.rules.some((rule) => evaluateCondition(rule, payload))
  }
  return step.rules.every((rule) => evaluateCondition(rule, payload))
}

function resolveDataTemplate(
  dataTemplate: Record<string, string> | undefined,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  if (dataTemplate) {
    for (const [k, v] of Object.entries(dataTemplate)) {
      data[k] = v.includes("{{") ? interpolate(v, payload) : (resolvePayloadPath(payload, v) ?? v)
    }
  }
  return data
}

function buildWebhookRequest(
  config: Record<string, unknown>,
  payload: Record<string, unknown>,
): { method: string; url: string; headers: Record<string, string> } {
  const url = interpolate(String(config.url ?? ""), payload)
  const method = String(config.method ?? "POST")
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (config.headers && typeof config.headers === "object") {
    for (const [k, v] of Object.entries(config.headers as Record<string, string>)) {
      headers[k] = interpolate(v, payload)
    }
  }
  return { method, url, headers }
}

function buildEmailParams(
  config: Record<string, unknown>,
  payload: Record<string, unknown>,
): { to: string; subject: string; html?: string; text?: string } {
  const to = interpolate(String(config.to ?? ""), payload)
  const subject = interpolate(String(config.subject ?? ""), payload)
  const html = config.html !== undefined ? interpolate(String(config.html), payload) : undefined
  const text =
    config.text !== undefined
      ? interpolate(String(config.text), payload)
      : config.body !== undefined
        ? interpolate(String(config.body), payload)
        : undefined
  return { to, subject, html, text }
}

export type FlowEngineOptions = {
  webhookRetryDelays?: number[]
  content?: {
    create(collection: string, data: Record<string, unknown>): Promise<Record<string, unknown>>
    update(
      collection: string,
      id: string,
      data: Record<string, unknown>,
    ): Promise<Record<string, unknown>>
    delete(collection: string, id: string): Promise<boolean>
  }
  sendEmail?: (msg: { to: string; subject: string; html?: string; text?: string }) => Promise<void>
  /** Called for each live-run lifecycle event. Wired to a RunEventBus by the
   *  server for SSE streaming. Dry-runs never emit. */
  onRunEvent?: (event: RunEvent) => void
}

export function createFlowEngine(store: FlowStore, options: FlowEngineOptions = {}) {
  const webhookRetryDelays = options.webhookRetryDelays ?? [1000, 5000, 15000]

  async function executeActionStep(
    step: ActionStep,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
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
        const { method, url, headers } = buildWebhookRequest(step.config, payload)
        const body = JSON.stringify(payload)
        const retryDelays = webhookRetryDelays
        let lastError: Error | null = null
        for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
          try {
            const res = await fetch(url, {
              method,
              headers,
              body,
              signal: AbortSignal.timeout(10000),
            })
            const responseBody = await res.text().catch(() => "")
            if (!res.ok) {
              lastError = new Error(`Webhook failed: ${res.status} ${responseBody}`)
              if (attempt < retryDelays.length) {
                await new Promise((r) => setTimeout(r, retryDelays[attempt]))
                continue
              }
              throw lastError
            }
            try {
              return JSON.parse(responseBody)
            } catch {
              return { response: responseBody, status: res.status }
            }
          } catch (err: any) {
            lastError = err
            if (attempt < retryDelays.length) {
              await new Promise((r) => setTimeout(r, retryDelays[attempt]))
              continue
            }
            throw lastError
          }
        }
        throw lastError ?? new Error("Webhook failed after retries")
      }
      case "action.email": {
        const { to, subject, html, text } = buildEmailParams(step.config, payload)
        if (!options.sendEmail) throw new Error("No email transport configured")
        await options.sendEmail({ to, subject, html, text })
        return { sent: true, to, subject }
      }
      case "action.create_content": {
        const collection = String(step.config.collection ?? "")
        const data = resolveDataTemplate(
          step.config.data as Record<string, string> | undefined,
          payload,
        )
        if (!options.content) throw new Error("No content adapter configured")
        const saved = await options.content.create(collection, data)
        return { action: "create_content", collection, documentId: saved.id, data: saved }
      }
      case "action.update_content": {
        const collection = String(step.config.collection ?? "")
        const documentId = interpolate(
          String(step.config.documentId ?? step.config.document_id ?? ""),
          payload,
        )
        const data = resolveDataTemplate(
          step.config.data as Record<string, string> | undefined,
          payload,
        )
        if (!options.content) throw new Error("No content adapter configured")
        const saved = await options.content.update(collection, documentId, data)
        return { action: "update_content", collection, documentId, data: saved }
      }
      case "action.delete_content": {
        const collection = String(step.config.collection ?? "")
        const documentId = interpolate(
          String(step.config.documentId ?? step.config.document_id ?? ""),
          payload,
        )
        if (!options.content) throw new Error("No content adapter configured")
        const deleted = await options.content.delete(collection, documentId)
        return { action: "delete_content", collection, documentId, deleted }
      }
      default:
        return payload
    }
  }

  type RunRecorder = {
    createRun(flowId: string, triggerEvent: string, payloadJson: string): string
    recordStep(input: RecordStepInput & { simulated?: boolean; summary?: string }): void
    completeRun(id: string, status: FlowRunStatus, error?: string): void
  }

  function storeRecorder(): RunRecorder {
    const emit = options.onRunEvent
    let flowId = ""
    return {
      createRun: (fId, triggerEvent, payloadJson) => {
        const run = store.createRun(fId, triggerEvent, payloadJson)
        flowId = fId
        emit?.({ type: "run.started", run })
        return run.id
      },
      // simulated/summary are dry-run-only fields; the store schema does not persist them
      recordStep: (input) => {
        const step = store.recordStep(input)
        emit?.({ type: "run.step", runId: input.run_id, flowId, step })
      },
      completeRun: (id, status, error) => {
        store.completeRun(id, status, error)
        // The run is already persisted; emitting must never affect completion.
        if (emit) {
          try {
            const run = store.getRun(id)
            if (run) emit({ type: "run.completed", run })
          } catch {
            // swallow: a read/emit failure must not re-mark the run
          }
        }
      },
    }
  }

  type SimResult = {
    payload: Record<string, unknown>
    output: unknown
    simulated: boolean
    summary?: string
  }

  async function simulateActionStep(
    step: ActionStep,
    payload: Record<string, unknown>,
  ): Promise<SimResult> {
    switch (step.type) {
      case "action.log":
      case "action.transform": {
        // Pure actions: run the real executor - it has no side effects.
        const output = await executeActionStep(step, payload)
        return { payload: output, output, simulated: false }
      }
      case "action.webhook": {
        const { method, url, headers } = buildWebhookRequest(step.config, payload)
        const request = { method, url, headers, body: payload }
        // Response is unknowable in a dry-run: thread the input payload unchanged.
        return {
          payload,
          output: { simulated: true, request },
          simulated: true,
          summary: `would ${method} ${url}`,
        }
      }
      case "action.email": {
        const { to, subject, html, text } = buildEmailParams(step.config, payload)
        const output = { simulated: true, to, subject, html, text }
        return {
          payload: { sent: true, to, subject },
          output,
          simulated: true,
          summary: `would email ${to}: ${subject}`,
        }
      }
      case "action.create_content": {
        const collection = String(step.config.collection ?? "")
        const data = resolveDataTemplate(
          step.config.data as Record<string, string> | undefined,
          payload,
        )
        // documentId is unknown until a real insert runs; use a sentinel so downstream steps do not break.
        const output = { action: "create_content", collection, documentId: "(simulated)", data }
        return {
          payload: output,
          output,
          simulated: true,
          summary: `would create in \`${collection}\``,
        }
      }
      case "action.update_content": {
        const collection = String(step.config.collection ?? "")
        const documentId = interpolate(
          String(step.config.documentId ?? step.config.document_id ?? ""),
          payload,
        )
        const data = resolveDataTemplate(
          step.config.data as Record<string, string> | undefined,
          payload,
        )
        const output = { action: "update_content", collection, documentId, data }
        return {
          payload: output,
          output,
          simulated: true,
          summary: `would update \`${documentId}\` in \`${collection}\``,
        }
      }
      case "action.delete_content": {
        const collection = String(step.config.collection ?? "")
        const documentId = interpolate(
          String(step.config.documentId ?? step.config.document_id ?? ""),
          payload,
        )
        const output = { action: "delete_content", collection, documentId, deleted: true }
        return {
          payload: output,
          output,
          simulated: true,
          summary: `would delete \`${documentId}\` from \`${collection}\``,
        }
      }
      default:
        // Unknown action type: pass the payload through unchanged.
        // If a new action type has side effects, add a case above.
        return { payload, output: payload, simulated: false }
    }
  }

  async function liveRun(step: ActionStep, payload: Record<string, unknown>): Promise<SimResult> {
    const out = await executeActionStep(step, payload)
    return { payload: out, output: out, simulated: false }
  }

  async function walk(
    flow: Flow,
    triggerPayload: Record<string, unknown>,
    ctx: { recorder: RunRecorder; simulate: boolean },
  ): Promise<string> {
    const { recorder, simulate } = ctx
    const runId = recorder.createRun(flow.id, flow.trigger.type, JSON.stringify(triggerPayload))
    if (flow.steps.length === 0) {
      recorder.completeRun(runId, "completed")
      return runId
    }
    let currentStep: FlowStep | undefined = flow.steps[0]
    let currentPayload = triggerPayload
    try {
      while (currentStep) {
        const step: FlowStep = currentStep
        const stepInput = JSON.stringify(currentPayload)
        const startedAt = new Date().toISOString()
        if (step.type === "condition") {
          const result = evaluateConditionStep(step, currentPayload)
          const branchTaken = result ? "true" : "false"
          recorder.recordStep({
            run_id: runId,
            step_id: step.id,
            status: "completed",
            input: stepInput,
            output: stepInput,
            branch_taken: branchTaken,
            started_at: startedAt,
            finished_at: new Date().toISOString(),
          })
          const nextId: string | null | undefined = result
            ? step.branches.true
            : step.branches.false
          currentStep = nextId ? resolveStepById(flow.steps, nextId) : undefined
        } else {
          try {
            const sim: SimResult = simulate
              ? await simulateActionStep(step, currentPayload)
              : await liveRun(step, currentPayload)
            recorder.recordStep({
              run_id: runId,
              step_id: step.id,
              status: "completed",
              input: stepInput,
              output: JSON.stringify(sim.output),
              started_at: startedAt,
              finished_at: new Date().toISOString(),
              simulated: sim.simulated,
              summary: sim.summary,
            })
            currentPayload = sim.payload
            currentStep = step.next ? resolveStepById(flow.steps, step.next) : undefined
          } catch (err: any) {
            recorder.recordStep({
              run_id: runId,
              step_id: step.id,
              status: "failed",
              input: stepInput,
              error: err.message,
              started_at: startedAt,
              finished_at: new Date().toISOString(),
            })
            recorder.completeRun(runId, "failed", err.message)
            return runId
          }
        }
      }
      recorder.completeRun(runId, "completed")
    } catch (err: any) {
      recorder.completeRun(runId, "failed", err.message)
    }
    return runId
  }

  async function executeFlow(flow: Flow, triggerPayload: Record<string, unknown>): Promise<string> {
    return walk(flow, triggerPayload, { recorder: storeRecorder(), simulate: false })
  }

  function createMemoryRecorder(): { recorder: RunRecorder; result(): DryRunResult } {
    let run: FlowRun | null = null
    const steps: DryRunStep[] = []
    const recorder: RunRecorder = {
      createRun: (flowId, triggerEvent, payloadJson) => {
        const id = `dry-${crypto.randomUUID()}`
        run = {
          id,
          flow_id: flowId,
          trigger_event: triggerEvent,
          trigger_payload: payloadJson,
          status: "running",
          started_at: new Date().toISOString(),
        }
        return id
      },
      recordStep: (input) => {
        steps.push({
          id: `dry-${crypto.randomUUID()}`,
          run_id: input.run_id,
          step_id: input.step_id,
          status: input.status,
          input: input.input,
          output: input.output,
          branch_taken: input.branch_taken,
          error: input.error,
          started_at: input.started_at ?? new Date().toISOString(),
          finished_at: input.finished_at,
          simulated: input.simulated,
          summary: input.summary,
        })
      },
      completeRun: (id, status, error) => {
        if (run && run.id === id) {
          run.status = status
          run.finished_at = new Date().toISOString()
          run.error = error
        }
      },
    }
    return {
      recorder,
      result: () => {
        if (!run) throw new Error("dry-run produced no run")
        return { ...run, steps }
      },
    }
  }

  async function dryRun(
    flow: Flow,
    triggerPayload: Record<string, unknown>,
  ): Promise<DryRunResult> {
    const { recorder, result } = createMemoryRecorder()
    await walk(flow, triggerPayload, { recorder, simulate: true })
    return result()
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

  return { executeFlow, retryRun, dryRun }
}

export type FlowEngine = ReturnType<typeof createFlowEngine>
