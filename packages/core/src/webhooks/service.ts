import type { WebhookStore } from "./store"
import type { WebhookConfig, WebhookEvent } from "./types"

const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 5000, 30000]

export function createWebhookService(store: WebhookStore) {
  function getMatchingWebhooks(event: WebhookEvent, collection: string): WebhookConfig[] {
    return store.list().filter((hook) => {
      if (!hook.active) return false
      if (!hook.events.includes(event)) return false
      if (hook.collection && hook.collection !== collection) return false
      return true
    })
  }

  async function dispatch(event: WebhookEvent, collection: string, payload: Record<string, unknown>): Promise<void> {
    const hooks = getMatchingWebhooks(event, collection)
    for (const hook of hooks) {
      const body = JSON.stringify({ event, collection, data: payload, timestamp: new Date().toISOString() })
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (hook.secret) {
        const encoder = new TextEncoder()
        const key = await crypto.subtle.importKey("raw", encoder.encode(hook.secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
        const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body))
        headers["X-Webhook-Signature"] = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("")
      }
      deliver(hook, event, body, headers, 1)
    }
  }

  async function deliver(hook: WebhookConfig, event: WebhookEvent, body: string, headers: Record<string, string>, attempt: number): Promise<void> {
    try {
      const res = await fetch(hook.url, { method: "POST", headers, body, signal: AbortSignal.timeout(10000) })
      store.logDelivery({ webhook_id: hook.id, event, status: res.status, request_body: body, response_body: await res.text().catch(() => ""), attempts: attempt })
      if (!res.ok && attempt < MAX_RETRIES) {
        setTimeout(() => deliver(hook, event, body, headers, attempt + 1), RETRY_DELAYS[attempt - 1])
      }
    } catch (err: any) {
      store.logDelivery({ webhook_id: hook.id, event, status: 0, request_body: body, response_body: err.message, attempts: attempt })
      if (attempt < MAX_RETRIES) {
        setTimeout(() => deliver(hook, event, body, headers, attempt + 1), RETRY_DELAYS[attempt - 1])
      }
    }
  }

  return { getMatchingWebhooks, dispatch }
}

export type WebhookService = ReturnType<typeof createWebhookService>
