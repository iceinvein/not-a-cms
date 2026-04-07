import type { FlowStore } from "./store"
import type { FlowEngine } from "./engine"

function matchField(pattern: string, value: number): boolean {
  if (pattern === "*") return true
  if (pattern.startsWith("*/")) {
    const divisor = parseInt(pattern.slice(2), 10)
    return value % divisor === 0
  }
  if (pattern.includes(",")) {
    return pattern.split(",").some(p => matchField(p.trim(), value))
  }
  if (pattern.includes("-")) {
    const [min, max] = pattern.split("-").map(Number)
    return value >= min && value <= max
  }
  return parseInt(pattern, 10) === value
}

export function matchesCron(expression: string, now: Date): boolean {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) return false
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts
  return (
    matchField(minute, now.getUTCMinutes()) &&
    matchField(hour, now.getUTCHours()) &&
    matchField(dayOfMonth, now.getUTCDate()) &&
    matchField(month, now.getUTCMonth() + 1) &&
    matchField(dayOfWeek, now.getUTCDay())
  )
}

export function createAutomationCron(store: FlowStore, engine: FlowEngine) {
  async function tick(): Promise<number> {
    const now = new Date()
    const cronFlows = store.getActiveFlowsByTrigger("schedule.cron")
    let triggered = 0
    for (const flow of cronFlows) {
      if (flow.trigger.type === "schedule.cron" && matchesCron(flow.trigger.cron, now)) {
        engine.executeFlow(flow, { event: "schedule.cron", timestamp: now.toISOString() }).catch(() => {})
        triggered++
      }
    }
    store.purgeOldRuns(30)
    return triggered
  }
  return { tick }
}

export type AutomationCron = ReturnType<typeof createAutomationCron>
